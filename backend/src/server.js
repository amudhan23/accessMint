// ============================================================
// API Server
// Connects the React frontend to the Hedera backend
// Run: npm run dev (from backend folder)
// ============================================================
import express from "express";
import cors from "cors";
import {
  AccountCreateTransaction,
  AccountBalanceQuery,
  AccountInfoFlow,
  Hbar,
  PrivateKey,
  AccountId,
  TransferTransaction,
} from "@hashgraph/sdk";
import { getClient } from "./hedera/client.js";
import { createAccessPlan } from "./hedera/create-plan.js";
import {
  associateToken,
  buyTokens,
  getTokenBalance,
} from "./hedera/buy-tokens.js";
import { createRedemptionLog, redeemToken } from "./hedera/redeem-token.js";
import {
  createMarketplaceTopic,
  listForSale,
  buyFromMarketplace,
} from "./hedera/marketplace.js";
import dotenv from "dotenv";
import { signRequest } from "@worldcoin/idkit-core/signing";
import fs from "fs";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// State (in-memory for hackathon)
let redemptionTopicId = null;
let marketplaceTopicId = null;
let demoUser = null; // simulated user account
let plans = {};
const apiKeys = {};
const users = {};
let walletProfiles = {};
let secondaryListings = [];
const walletAuthChallenges = new Map();
const walletSessions = new Map();

const STATE_FILE = "./state.json";
const AUTH_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const WALLET_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const TINYBARS_PER_HBAR = 100_000_000n;
const DEMO_BUYER_MIN_HBAR = 1.25;
const DEMO_BUYER_HBAR_BUFFER = 0.75;
const WORLD_ID_ACTION = process.env.WORLD_ID_ACTION || "marketplaceverify";
const WORLD_ID_ENVIRONMENT = process.env.WORLD_ID_ENVIRONMENT || "staging";
const WORLD_ID_APP_ID =
  process.env.WORLD_APP_ID || process.env.WORLD_ID_APP_ID || "";
const WORLD_ID_VERIFY_BASE_URL =
  process.env.WORLD_ID_VERIFY_BASE_URL || "https://developer.world.org";
const WORLD_ID_V2_VERIFY_BASE_URLS = (
  process.env.WORLD_ID_V2_VERIFY_BASE_URLS ||
  "https://developer.worldcoin.org,https://developer.world.org"
)
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

function saveState() {
  const state = {
    users: {},
    plans,
    apiKeys,
    walletProfiles,
    secondaryListings,
  };
  // Save user accounts (including private keys for demo only)
  for (const [key, user] of Object.entries(users)) {
    state.users[key] = {
      accountId: user.accountId.toString(),
      privateKey: user.privateKey.toStringRaw(),
      name: user.name,
      walletAddress: user.walletAddress || "",
    };
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);
  return req.headers["x-wallet-session"] || "";
}

function getSessionWalletAccountId(req) {
  const token = getBearerToken(req);
  if (!token) return "";

  const session = walletSessions.get(token);
  if (!session) return "";

  if (session.expiresAt <= Date.now()) {
    walletSessions.delete(token);
    return "";
  }

  return session.accountId;
}

function getWalletAccountId(req) {
  return getSessionWalletAccountId(req);
}

function requireWalletAccountId(req, res) {
  const walletAccountId = getWalletAccountId(req);
  if (!walletAccountId) {
    res.status(401).json({
      error: "WALLET_AUTH_REQUIRED",
      message:
        "Connect and authenticate your wallet before buying, redeeming, listing, or purchasing tokens.",
    });
    return null;
  }
  return walletAccountId;
}

function buildWalletAuthMessage(accountId, nonce, issuedAt) {
  return [
    "AccessMint wallet authentication",
    "",
    `Wallet: ${accountId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    "Network: Hedera Testnet",
    "",
    "Only sign this message if you are logging into AccessMint.",
  ].join("\n");
}

function prefixHederaMessage(message) {
  return `\x19Hedera Signed Message:\n${message.length}${message}`;
}

function ensureWalletProfile(walletAccountId) {
  const id = walletAccountId || "demo";
  if (!walletProfiles[id]) {
    walletProfiles[id] = {
      accountId: id,
      tokenBalances: {},
      apiKeys: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return walletProfiles[id];
}

function updateWalletBalance(walletAccountId, tokenId, delta) {
  const profile = ensureWalletProfile(walletAccountId);
  const current = Number(profile.tokenBalances[tokenId] || 0);
  profile.tokenBalances[tokenId] = Math.max(0, current + delta);
  profile.updatedAt = new Date().toISOString();
  return profile.tokenBalances[tokenId];
}

function setWalletApiKey(walletAccountId, tokenId, keyInfo) {
  const profile = ensureWalletProfile(walletAccountId);
  profile.apiKeys[tokenId] = keyInfo;
  profile.updatedAt = new Date().toISOString();
}

function getWalletState(walletAccountId) {
  const profile = ensureWalletProfile(walletAccountId);
  return {
    accountId: profile.accountId,
    userTokens: profile.tokenBalances || {},
    apiKeys: profile.apiKeys || {},
    updatedAt: profile.updatedAt,
  };
}

function getWalletTokenBalance(walletAccountId, tokenId) {
  const profile = ensureWalletProfile(walletAccountId);
  return Number(profile.tokenBalances?.[tokenId] || 0);
}

function hbarToTinybars(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0n;
  return BigInt(Math.ceil(numericValue * Number(TINYBARS_PER_HBAR)));
}

function tinybarsToHbarNumber(tinybars) {
  return Number(tinybars) / Number(TINYBARS_PER_HBAR);
}

async function ensureDemoBuyerFunding(requiredHbar = 0) {
  if (!demoUser?.accountId) return;

  const { client, accountId: operatorAccountId } = getClient();
  const balance = await new AccountBalanceQuery()
    .setAccountId(demoUser.accountId)
    .execute(client);
  const currentTinybars = BigInt(balance.hbars.toTinybars().toString());
  const targetHbar = Math.max(
    DEMO_BUYER_MIN_HBAR,
    Number(requiredHbar || 0) + DEMO_BUYER_HBAR_BUFFER,
  );
  const targetTinybars = hbarToTinybars(targetHbar);

  if (currentTinybars >= targetTinybars) return;

  const topUpTinybars = targetTinybars - currentTinybars;
  const topUpHbar = Number(tinybarsToHbarNumber(topUpTinybars).toFixed(8));
  const response = await new TransferTransaction()
    .addHbarTransfer(operatorAccountId, new Hbar(-topUpHbar))
    .addHbarTransfer(demoUser.accountId, new Hbar(topUpHbar))
    .execute(client);

  await response.getReceipt(client);
  console.log(
    `   Demo buyer ${demoUser.accountId} topped up with ${topUpHbar} HBAR`,
  );
}

function getClaimedSupply(tokenId) {
  const walletHeld = Object.values(walletProfiles || {}).reduce(
    (total, profile) => total + Number(profile?.tokenBalances?.[tokenId] || 0),
    0,
  );
  const listed = secondaryListings.reduce((total, listing) => {
    if (!listing.active || String(listing.tokenId) !== String(tokenId)) {
      return total;
    }
    return total + Number(listing.amount || 0);
  }, 0);

  return walletHeld + listed;
}

function normalizePlanSupplyState() {
  let changed = false;

  for (const [tokenId, plan] of Object.entries(plans)) {
    const totalSupply = Number(plan.totalSupply ?? plan.supply ?? 0);
    const savedSupply = Number(plan.remainingSupply);
    if (Number.isFinite(savedSupply)) continue;

    plan.remainingSupply = Math.max(0, totalSupply - getClaimedSupply(tokenId));
    changed = true;
  }

  return changed;
}

async function verifyWorldIdV4Proof({ verifierId, proofPayload }) {
  const verifyRes = await fetch(
    `${WORLD_ID_VERIFY_BASE_URL}/api/v4/verify/${encodeURIComponent(verifierId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proofPayload),
    },
  );
  const result = await verifyRes.json().catch(() => ({}));
  const successfulResult = result.results?.find((item) => item.success);
  const verified =
    verifyRes.ok && (result.success === true || Boolean(successfulResult));

  return {
    verified,
    result,
    successfulResult,
    endpoint: verifierId.startsWith("app_") ? "v4-app" : "v4-rp",
  };
}

async function verifyWorldIdV2Proof({ appId, idkitResponse }) {
  const legacyResponse =
    idkitResponse.responses?.find((response) => response.merkle_root || response.root) ||
    idkitResponse.responses?.[0] ||
    {};
  const v2Payload = {
    ...idkitResponse,
    merkle_root:
      idkitResponse.merkle_root ||
      idkitResponse.root ||
      legacyResponse.merkle_root ||
      legacyResponse.root,
    nullifier_hash:
      idkitResponse.nullifier_hash ||
      idkitResponse.nullifier ||
      legacyResponse.nullifier_hash ||
      legacyResponse.nullifier,
    proof: idkitResponse.proof || legacyResponse.proof,
    action: WORLD_ID_ACTION,
    verification_level: idkitResponse.verification_level || "device",
  };
  delete v2Payload.environment;
  delete v2Payload.responses;
  delete v2Payload.root;
  delete v2Payload.nullifier;

  const missingFields = ["merkle_root", "nullifier_hash", "proof"].filter(
    (field) => !v2Payload[field],
  );
  if (missingFields.length > 0) {
    return {
      verified: false,
      result: {
        code: "invalid_legacy_proof",
        detail: `Missing legacy proof field(s): ${missingFields.join(", ")}`,
      },
      endpoint: "v2",
    };
  }

  let lastResult = null;
  for (const baseUrl of WORLD_ID_V2_VERIFY_BASE_URLS) {
    const verifyRes = await fetch(
      `${baseUrl}/api/v2/verify/${encodeURIComponent(appId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v2Payload),
      },
    );
    const result = await verifyRes.json().catch(() => ({}));
    lastResult = result;

    if (verifyRes.ok && result.success !== false && !result.code && !result.error) {
      return { verified: true, result, endpoint: "v2" };
    }
  }

  return { verified: false, result: lastResult, endpoint: "v2" };
}

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    console.log("   ✅ State restored from file");
    return data;
  } catch (e) {
    console.log("   ℹ No saved state, starting fresh");
    return null;
  }
}

// Initialize on startup
async function init() {
  console.log("🚀 Initializing AccessMint server...\n");

  const { client } = getClient();
  const saved = loadState();

  if (saved && saved.users?.alice) {
    console.log("   📂 Restoring previous session...\n");

    const aliceKey = PrivateKey.fromStringED25519(saved.users.alice.privateKey);
    users["alice"] = {
      accountId: AccountId.fromString(saved.users.alice.accountId),
      privateKey: aliceKey,
      name: "Alice",
    };

    const bobKey = PrivateKey.fromStringED25519(saved.users.bob.privateKey);
    users["bob"] = {
      accountId: AccountId.fromString(saved.users.bob.accountId),
      privateKey: bobKey,
      name: "Bob",
    };

    demoUser = users["alice"];
    Object.assign(plans, saved.plans || {});
    Object.assign(apiKeys, saved.apiKeys || {});
    walletProfiles = saved.walletProfiles || {};
    secondaryListings = saved.secondaryListings || [];
    if (normalizePlanSupplyState()) {
      saveState();
    }

    console.log(`   ✅ Alice: ${users["alice"].accountId}`);
    console.log(`   ✅ Bob: ${users["bob"].accountId}`);
    console.log(`   ✅ Plans: ${Object.keys(plans).length}`);
  } else {
    console.log("   🆕 Creating fresh accounts...\n");

    const aliceKey = PrivateKey.generateED25519();
    const aliceTx = new AccountCreateTransaction()
      .setKey(aliceKey.publicKey)
      .setInitialBalance(new Hbar(1));
    const aliceRes = await aliceTx.execute(client);
    const aliceReceipt = await aliceRes.getReceipt(client);
    users["alice"] = {
      accountId: aliceReceipt.accountId,
      privateKey: aliceKey,
      name: "Alice",
    };
    console.log(`   ✅ Alice: ${users["alice"].accountId}`);

    const bobKey = PrivateKey.generateED25519();
    const bobTx = new AccountCreateTransaction()
      .setKey(bobKey.publicKey)
      .setInitialBalance(new Hbar(1));
    const bobRes = await bobTx.execute(client);
    const bobReceipt = await bobRes.getReceipt(client);
    users["bob"] = {
      accountId: bobReceipt.accountId,
      privateKey: bobKey,
      name: "Bob",
    };
    console.log(`   ✅ Bob: ${users["bob"].accountId}`);

    demoUser = users["alice"];

    console.log("\n🏭 Creating demo API providers...\n");

    const plan1 = await createAccessPlan({
      name: "Crypto Price Intelligence",
      symbol: "CRYPTO",
      totalSupply: 50,
      pricePerTokenHbar: 0.1,
    });
    plan1.ensName = "cryptointel.eth";
    plan1.apiEndpoint =
      "https://api.coingecko.com/api/v3/simple/price?ids={query}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true";
    plan1.description = "Real-time crypto prices, market cap, 24h changes";
    plan1.remainingSupply = plan1.totalSupply;
    plans[plan1.tokenId] = plan1;

    const plan2 = await createAccessPlan({
      name: "Weather Intelligence API",
      symbol: "WTHR",
      totalSupply: 50,
      pricePerTokenHbar: 0.1,
    });
    plan2.ensName = "weatherapi.eth";
    plan2.apiEndpoint =
      "https://geocoding-api.open-meteo.com/v1/search?name={query}&count=1";
    plan2.description = "Global weather data for any city";
    plan2.remainingSupply = plan2.totalSupply;
    plans[plan2.tokenId] = plan2;

    saveState();
  }

  // Topics created fresh each restart
  redemptionTopicId = await createRedemptionLog();
  marketplaceTopicId = await createMarketplaceTopic();

  console.log("\n✅ Server ready!\n");
}

// POST /api/plans — Create a new access plan
app.post("/api/plans", async (req, res) => {
  try {
    const plan = await createAccessPlan(req.body);
    plan.ensName = req.body.ensName || "";
    plan.apiEndpoint = req.body.apiEndpoint || "";
    plan.description = req.body.description || "";
    plan.remainingSupply = plan.totalSupply;
    plans[plan.tokenId] = plan;
    console.log(`   📡 API endpoint: ${plan.apiEndpoint || "none"}`);
    res.json(plan);
    saveState();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/plans", (req, res) => {
  res.json(Object.values(plans));
});

app.post("/api/auth/nonce", (req, res) => {
  const accountId = String(req.body?.accountId || "").trim();
  if (!accountId) {
    return res.status(400).json({
      error: "ACCOUNT_REQUIRED",
      message: "Connect a Hedera wallet before authenticating.",
    });
  }

  const nonce = crypto.randomBytes(24).toString("hex");
  const issuedAt = new Date().toISOString();
  const message = buildWalletAuthMessage(accountId, nonce, issuedAt);

  walletAuthChallenges.set(nonce, {
    accountId,
    message,
    expiresAt: Date.now() + AUTH_CHALLENGE_TTL_MS,
  });

  res.json({
    accountId,
    nonce,
    message,
    expiresAt: Date.now() + AUTH_CHALLENGE_TTL_MS,
  });
});

app.post("/api/auth/verify", async (req, res) => {
  try {
    const accountId = String(req.body?.accountId || "").trim();
    const nonce = String(req.body?.nonce || "").trim();
    const signature = String(req.body?.signature || "").trim();
    const challenge = walletAuthChallenges.get(nonce);

    if (!accountId || !nonce || !signature || !challenge) {
      return res.status(400).json({
        error: "INVALID_AUTH_CHALLENGE",
        message: "Wallet authentication challenge is missing or expired.",
      });
    }

    if (challenge.expiresAt <= Date.now()) {
      walletAuthChallenges.delete(nonce);
      return res.status(400).json({
        error: "AUTH_CHALLENGE_EXPIRED",
        message: "Wallet authentication challenge expired. Try connecting again.",
      });
    }

    if (challenge.accountId !== accountId) {
      return res.status(401).json({
        error: "ACCOUNT_MISMATCH",
        message: "Signed wallet account does not match the requested account.",
      });
    }

    const { client } = getClient();
    const messageBytes = Buffer.from(prefixHederaMessage(challenge.message));
    const signatureBytes = Buffer.from(signature, "base64");
    const verified = await AccountInfoFlow.verifySignature(
      client,
      accountId,
      messageBytes,
      signatureBytes,
    );

    if (!verified) {
      return res.status(401).json({
        error: "INVALID_WALLET_SIGNATURE",
        message: "Wallet signature could not be verified on Hedera.",
      });
    }

    walletAuthChallenges.delete(nonce);

    if (users["alice"]) {
      demoUser = users["alice"];
      demoUser.walletAddress = accountId;
    }

    ensureWalletProfile(accountId);
    saveState();

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + WALLET_SESSION_TTL_MS;
    walletSessions.set(sessionToken, { accountId, expiresAt });

    res.json({
      authenticated: true,
      accountId,
      sessionToken,
      expiresAt,
      walletState: getWalletState(accountId),
      listings: secondaryListings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "WALLET_AUTH_FAILED",
      message: err.message,
    });
  }
});

app.post("/api/auth/walletconnect-session", (req, res) => {
  const accountId = String(req.body?.accountId || "").trim();
  if (!accountId) {
    return res.status(400).json({
      error: "ACCOUNT_REQUIRED",
      message: "Connect a Hedera wallet before authenticating.",
    });
  }

  if (users["alice"]) {
    demoUser = users["alice"];
    demoUser.walletAddress = accountId;
  }

  ensureWalletProfile(accountId);
  saveState();

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + WALLET_SESSION_TTL_MS;
  walletSessions.set(sessionToken, {
    accountId,
    expiresAt,
    authMethod: "walletconnect-session",
  });

  res.json({
    authenticated: true,
    authMethod: "walletconnect-session",
    accountId,
    sessionToken,
    expiresAt,
    walletState: getWalletState(accountId),
    listings: secondaryListings,
  });
});

app.get("/api/auth/session", (req, res) => {
  const accountId = getSessionWalletAccountId(req);
  if (!accountId) {
    return res.status(401).json({
      error: "SESSION_EXPIRED",
      message: "Wallet session expired. Sign in with your wallet again.",
    });
  }

  res.json({
    authenticated: true,
    accountId,
    walletState: getWalletState(accountId),
    listings: secondaryListings,
  });
});

app.get("/api/wallet-state", (req, res) => {
  const walletAccountId = getWalletAccountId(req);
  if (!walletAccountId) {
    return res.status(401).json({
      error: "SESSION_REQUIRED",
      message: "Authenticate your wallet to load wallet-owned API access.",
    });
  }
  res.json({
    ...getWalletState(walletAccountId),
    listings: secondaryListings,
  });
});

app.get("/api/listings", (req, res) => {
  res.json(secondaryListings);
});

// POST /api/buy — Buy tokens from provider
app.post("/api/buy", async (req, res) => {
  try {
    const { tokenId, amount, pricePerTokenHbar } = req.body;
    const walletAccountId = requireWalletAccountId(req, res);
    if (!walletAccountId) return;
    const { accountId: providerAccountId } = getClient();
    const plan = plans[tokenId];
    const purchaseAmount = Number(amount);
    const unitPriceHbar = Number(pricePerTokenHbar);
    const currentSupply = Number(plan?.remainingSupply ?? plan?.availableSupply ?? plan?.totalSupply ?? 0);

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0) {
      return res.status(400).json({
        error: "INVALID_AMOUNT",
        message: "Choose at least 1 API call to buy.",
      });
    }

    if (!Number.isFinite(unitPriceHbar) || unitPriceHbar <= 0) {
      return res.status(400).json({
        error: "INVALID_PRICE",
        message: "This API has an invalid HBAR price.",
      });
    }

    if (purchaseAmount > currentSupply) {
      return res.status(400).json({
        error: "INSUFFICIENT_SUPPLY",
        message: `Only ${currentSupply} ${plan.symbol} tokens are available.`,
      });
    }

    await ensureDemoBuyerFunding(purchaseAmount * unitPriceHbar);

    // Associate user with token (ignore error if already associated)
    try {
      await associateToken(demoUser.accountId, demoUser.privateKey, tokenId);
    } catch (e) {
      /* already associated */
    }

    const result = await buyTokens({
      buyerAccountId: demoUser.accountId,
      buyerPrivateKey: demoUser.privateKey,
      providerAccountId,
      tokenId,
      amount: purchaseAmount,
      pricePerTokenHbar: unitPriceHbar,
    });

    updateWalletBalance(walletAccountId, tokenId, purchaseAmount);
    plan.remainingSupply = Math.max(0, currentSupply - purchaseAmount);
    plans[tokenId] = plan;
    saveState();
    res.json({ ...result, plan, walletState: getWalletState(walletAccountId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/list — List tokens for resale
app.post("/api/list", async (req, res) => {
  try {
    const { tokenId, symbol, amount, pricePerTokenHbar, retailPrice } =
      req.body;
    const walletAccountId = requireWalletAccountId(req, res);
    if (!walletAccountId) return;
    const profile = ensureWalletProfile(walletAccountId);
    const balance = Number(profile.tokenBalances[tokenId] || 0);

    if (balance < Number(amount)) {
      return res.status(400).json({ error: "Not enough tokens to list" });
    }

    const listing = await listForSale({
      sellerAccountId: demoUser.accountId,
      tokenId,
      amount,
      pricePerTokenHbar,
      topicId: marketplaceTopicId,
    });

    listing.symbol = symbol;
    listing.retailPrice = retailPrice;
    listing.ensName = plans[tokenId]?.ensName || req.body.ensName || "";
    listing.walletAccountId = walletAccountId;
    secondaryListings.push(listing);
    updateWalletBalance(walletAccountId, tokenId, -Number(amount));
    saveState();
    res.json({ ...listing, walletState: getWalletState(walletAccountId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/marketplace/buy — Buy from marketplace
app.post("/api/marketplace/buy", async (req, res) => {
  try {
    const { listingId, tokenId: requestTokenId } = req.body;
    const walletAccountId = requireWalletAccountId(req, res);
    if (!walletAccountId) return;
    const buyer = demoUser;

    try {
      const planTokenId = Object.values(plans)[0]?.tokenId;
      if (planTokenId) {
        await associateToken(buyer.accountId, buyer.privateKey, planTokenId);
      }
    } catch (e) {
      /* already associated */
    }

    const sellerKey = demoUser.name === "Alice" ? "bob" : "alice";
    const seller = users[sellerKey];

    const result = await buyFromMarketplace({
      listingId,
      buyerAccountId: buyer.accountId,
      buyerPrivateKey: buyer.privateKey,
      sellerPrivateKey: seller.privateKey,
      topicId: marketplaceTopicId,
    });

    // Generate API key for the buyer
    const localListing = secondaryListings.find(
      (listing) => listing.id === listingId,
    );
    const tokenId = requestTokenId || localListing?.tokenId || Object.keys(plans)[0];
    const apiKey = "ak_" + Math.random().toString(36).slice(2, 15);
    apiKeys[apiKey] = {
      accountId: buyer.accountId.toString(),
      privateKey: buyer.privateKey.toStringRaw(),
      walletAccountId,
      tokenId,
      planName: plans[tokenId]?.name || "Unknown",
      tokensRemaining: Number(result.amount || 0),
      createdAt: new Date().toISOString(),
    };
    result.apiKey = apiKey;
    result.apiKeyInfo = {
      key: apiKey,
      endpoint: "http://localhost:3001/v1/call",
      usage: "Authorization: Bearer " + apiKey,
    };
    setWalletApiKey(walletAccountId, tokenId, result.apiKeyInfo);
    updateWalletBalance(walletAccountId, tokenId, Number(result.amount || 0));
    secondaryListings = secondaryListings.map((listing) =>
      listing.id === listingId ? { ...listing, active: false } : listing,
    );
    result.walletState = getWalletState(walletAccountId);
    result.listings = secondaryListings;

    console.log(`   🔑 API key for ${buyer.name}: ${apiKey}`);

    saveState();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/verify-worldid — Verify World ID proof
// app.post("/api/verify-worldid", async (req, res) => {
//   try {
//     const proof = req.body;

//     // Verify with World ID API
//     const verifyRes = await fetch(
//       `https://developer.world.org/api/v2/verify/app_staging_xxxxx`,
//       {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           ...proof,
//           action: "marketplace-verify",
//           verification_level: "device",
//         }),
//       },
//     );

//     const result = await verifyRes.json();

//     if (verifyRes.ok) {
//       console.log("✅ World ID verified!");
//       res.json({ verified: true, nullifier_hash: result.nullifier_hash });
//     } else {
//       console.log("❌ World ID failed:", result);
//       res.json({ verified: false, error: result });
//     }
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ verified: false, error: err.message });
//   }
// });

app.post("/api/verify-worldid-demo-disabled", async (req, res) => {
  return res.status(410).json({
    verified: false,
    error: "Demo bypass removed. Use /api/verify-worldid.",
  });
  try {
    console.log("✅ World ID verification received");
    // For hackathon demo: accept the proof
    // Production: verify with World ID API
    res.json({ verified: true });
  } catch (err) {
    res.status(500).json({ verified: false, error: err.message });
  }
});

// Generate RP signature for World ID
app.post("/api/rp-signature", async (req, res) => {
  try {
    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: process.env.WORLD_SIGNING_KEY,
      action: WORLD_ID_ACTION,
    });
    res.json({
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
      rp_id: process.env.WORLD_RP_ID,
      app_id: WORLD_ID_APP_ID || null,
      action: WORLD_ID_ACTION,
      environment: WORLD_ID_ENVIRONMENT,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Verify World ID proof
app.post("/api/verify-worldid", async (req, res) => {
  try {
    const { idkitResponse } = req.body || {};
    const rpId = process.env.WORLD_RP_ID || req.body?.rp_id;
    const appId = WORLD_ID_APP_ID || req.body?.app_id || idkitResponse?.app_id;

    if (!rpId) {
      return res.status(500).json({
        verified: false,
        error: "WORLD_RP_ID is not configured on the backend.",
      });
    }

    if (!idkitResponse || typeof idkitResponse !== "object") {
      return res.status(400).json({
        verified: false,
        error: "Missing World ID proof payload.",
      });
    }

    const proofPayload = {
      ...idkitResponse,
      action: WORLD_ID_ACTION,
      environment: idkitResponse.environment || WORLD_ID_ENVIRONMENT,
    };
    let verification = await verifyWorldIdV4Proof({
      verifierId: rpId,
      proofPayload,
    });
    let result = verification.result || {};
    let verificationEndpoint = verification.endpoint;
    let successfulResult = verification.successfulResult;
    let verified = verification.verified;

    if (!verified && appId && result.code === "app_not_migrated") {
      verification = await verifyWorldIdV4Proof({
        verifierId: appId,
        proofPayload,
      });
      result = verification.result || {};
      verificationEndpoint = verification.endpoint;
      successfulResult = verification.successfulResult;
      verified = verification.verified;
    }

    if (!verified && result.code === "app_not_migrated") {
      if (!appId) {
        return res.status(400).json({
          verified: false,
          error:
            "World app is not migrated to v4, and WORLD_APP_ID/app_id was not provided for v2 verification.",
        });
      }

      const v2Verification = await verifyWorldIdV2Proof({
        appId,
        idkitResponse,
      });
      result = v2Verification.result || {};
      verificationEndpoint = v2Verification.endpoint;
      successfulResult = null;
      verified = v2Verification.verified;
    }

    if (verified) {
      console.log("✅ World ID verified!");
      res.json({
        verified: true,
        nullifier_hash:
          result.nullifier_hash ||
          result.nullifier ||
          successfulResult?.nullifier ||
          null,
        action: result.action || WORLD_ID_ACTION,
        environment: result.environment || WORLD_ID_ENVIRONMENT,
        session_id: result.session_id || null,
        verification_endpoint: verificationEndpoint,
      });
    } else {
      console.log("World ID verification failed:", result);
      res.status(400).json({ verified: false, error: result });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ verified: false, error: err.message });
  }
});

app.post("/api/redeem", async (req, res) => {
  try {
    const { tokenId, query } = req.body;
    const walletAccountId = requireWalletAccountId(req, res);
    if (!walletAccountId) return;
    const profile = ensureWalletProfile(walletAccountId);
    const profileBalance = Number(profile.tokenBalances[tokenId] || 0);

    if (profileBalance <= 0) {
      return res.status(403).json({ error: "No tokens remaining" });
    }

    const { accountId: providerAccountId } = getClient();

    // Step 1: Burn the token on Hedera
    const result = await redeemToken({
      userAccountId: demoUser.accountId,
      userPrivateKey: demoUser.privateKey,
      providerAccountId,
      tokenId,
      topicId: redemptionTopicId,
    });

    // Step 2: Look up provider's registered API
    const plan = plans[tokenId];
    if (!plan) {
      return res.json({ ...result, apiResponse: { error: "Plan not found" } });
    }

    // Step 3: Call the provider's wrapped API
    let apiData = {};
    const userQuery = query || "";

    if (plan.apiEndpoint) {
      try {
        let apiUrl = plan.apiEndpoint.replace(
          "{query}",
          encodeURIComponent(userQuery),
        );
        console.log(`   📡 Calling: ${apiUrl}`);
        const apiRes = await fetch(apiUrl);
        const rawData = await apiRes.json();

        // Format response based on service type
        if (plan.name.includes("Crypto")) {
          const coin = userQuery.toLowerCase() || "bitcoin";
          const coinData = rawData[coin];
          if (coinData) {
            apiData = {
              coin: coin,
              price_usd: "$" + coinData.usd.toLocaleString(),
              market_cap:
                "$" + Math.round(coinData.usd_market_cap).toLocaleString(),
              change_24h: (coinData.usd_24h_change || 0).toFixed(2) + "%",
            };
          } else {
            apiData = {
              error: "Coin not found. Try: bitcoin, ethereum, hedera-hashgraph",
            };
          }
        } else if (plan.name.includes("Weather")) {
          const loc = rawData.results?.[0];
          if (loc) {
            const wxRes = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`,
            );
            const wxData = await wxRes.json();
            apiData = {
              city: loc.name,
              country: loc.country,
              temperature: wxData.current_weather.temperature + "°C",
              wind_speed: wxData.current_weather.windspeed + " km/h",
              wind_direction: wxData.current_weather.winddirection + "°",
            };
          } else {
            apiData = { error: "City not found" };
          }
        } else {
          apiData = rawData;
        }
      } catch (e) {
        console.error("API call failed:", e.message);
        apiData = { error: "API call failed: " + e.message };
      }
    } else {
      apiData = { message: "No API endpoint registered for this plan" };
    }

    const newBalance = updateWalletBalance(walletAccountId, tokenId, -1);

    result.apiResponse = {
      service: plan.name,
      provider: plan.ensName,
      status: 200,
      data: apiData,
      tokensRemaining: newBalance,
      token_burned: true,
      verified_on: `https://hashscan.io/testnet/topic/${redemptionTopicId}`,
      timestamp: new Date().toISOString(),
    };

    result.walletState = getWalletState(walletAccountId);
    saveState();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Generate API key after buying tokens
app.post("/api/generate-key", async (req, res) => {
  const { tokenId } = req.body;
  const walletAccountId = requireWalletAccountId(req, res);
  if (!walletAccountId) return;
  const profile = ensureWalletProfile(walletAccountId);
  if (Number(profile.tokenBalances[tokenId] || 0) <= 0) {
    return res.status(403).json({
      error: "NO_TOKENS_FOR_KEY",
      message: "Buy tokens for this API before generating an API key.",
    });
  }
  const plan = plans[tokenId];
  const apiKey = "ak_" + Math.random().toString(36).slice(2, 15);

  apiKeys[apiKey] = {
    accountId: demoUser.accountId.toString(),
    privateKey: demoUser.privateKey.toStringRaw(),
    walletAccountId,
    tokenId,
    planName: plan?.name || "Unknown",
    tokensRemaining: Number(profile.tokenBalances[tokenId] || 0),
    createdAt: new Date().toISOString(),
  };

  console.log(`   🔑 API key generated: ${apiKey} → ${plan?.name}`);

  const keyInfo = {
    apiKey,
    service: plan?.name,
    endpoint: `http://localhost:3001/v1/call`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: { query: "bitcoin" },
    example_curl: `curl -X POST http://localhost:3001/v1/call -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" -d '{"query":"bitcoin"}'`,
  };

  setWalletApiKey(walletAccountId, tokenId, keyInfo);
  saveState();
  res.json({ ...keyInfo, walletState: getWalletState(walletAccountId) });
});

app.post("/api/switch-user", (req, res) => {
  const { userId } = req.body;
  if (users[userId]) {
    demoUser = users[userId];
    console.log(`   👤 Switched to ${demoUser.name}`);
    res.json({ name: demoUser.name, accountId: demoUser.accountId.toString() });
  } else {
    res.status(400).json({ error: "Unknown user" });
  }
});

app.get("/api/current-user", (req, res) => {
  res.json({ name: demoUser.name, accountId: demoUser.accountId.toString() });
});

app.post("/api/wallet-connected", async (req, res) => {
  const { accountId } = req.body;
  console.log(`   Wallet connected without auth proof: ${accountId}`);
  res.status(401).json({
    error: "WALLET_AUTH_REQUIRED",
    message: "Use /api/auth/nonce and /api/auth/verify before wallet state is attached.",
  });
});

// The actual API endpoint — called from Postman or user's code
app.post("/v1/call", async (req, res) => {
  // Check API key
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "MISSING_API_KEY",
      message: "Include Authorization: Bearer <your_key>",
    });
  }

  const apiKey = authHeader.split(" ")[1];
  const keyData = apiKeys[apiKey];
  if (!keyData) {
    return res
      .status(401)
      .json({ error: "INVALID_API_KEY", message: "API key not found" });
  }

  // Check token balance
  const keyAccountId =
    typeof keyData.accountId === "string"
      ? AccountId.fromString(keyData.accountId)
      : keyData.accountId;
  const keyPrivateKey =
    typeof keyData.privateKey === "string"
      ? PrivateKey.fromStringED25519(keyData.privateKey)
      : keyData.privateKey;
  const balance = keyData.walletAccountId
    ? getWalletTokenBalance(keyData.walletAccountId, keyData.tokenId)
    : await getTokenBalance(keyAccountId, keyData.tokenId);
  console.log(
    `   🔍 Debug: key=${apiKey}, accountId=${keyData.accountId}, tokenId=${keyData.tokenId}, balance=${balance}`,
  );

  if (balance <= 0) {
    keyData.tokensRemaining = 0;
    keyData.lastRejectedAt = new Date().toISOString();
    saveState();
    return res.status(403).json({
      error: "NO_TOKENS_REMAINING",
      message:
        "This API key has 0 calls remaining. Buy more access to reactivate it.",
      tokens_remaining: 0,
      marketplace: "http://localhost:5173/marketplace",
    });
  }

  // Check token balance
  //   const balance = await getTokenBalance(keyData.accountId, keyData.tokenId);
  console.log(
    `   🔍 Debug: key=${apiKey}, accountId=${keyData.accountId}, tokenId=${keyData.tokenId}, balance=${balance}`,
  );

  // Burn 1 token
  const { accountId: providerAccountId } = getClient();
  await redeemToken({
    userAccountId: keyAccountId,
    userPrivateKey: keyPrivateKey,
    providerAccountId,
    tokenId: keyData.tokenId,
    topicId: redemptionTopicId,
  });

  // Call the provider's wrapped API
  const plan = plans[keyData.tokenId];
  const query = req.body.query || "";
  let apiData = {};

  if (plan?.apiEndpoint) {
    try {
      let apiUrl = plan.apiEndpoint.replace(
        "{query}",
        encodeURIComponent(query),
      );
      const apiRes = await fetch(apiUrl);
      const rawData = await apiRes.json();

      if (plan.name.includes("Crypto")) {
        const coin = query.toLowerCase() || "bitcoin";
        const coinData = rawData[coin];
        if (coinData) {
          apiData = {
            coin,
            price_usd: "$" + coinData.usd.toLocaleString(),
            market_cap:
              "$" + Math.round(coinData.usd_market_cap).toLocaleString(),
            change_24h: (coinData.usd_24h_change || 0).toFixed(2) + "%",
          };
        } else {
          apiData = { error: "Coin not found" };
        }
      } else if (plan.name.includes("Weather")) {
        const loc = rawData.results?.[0];
        if (loc) {
          const wxRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`,
          );
          const wxData = await wxRes.json();
          apiData = {
            city: loc.name,
            country: loc.country,
            temperature: wxData.current_weather.temperature + "°C",
            wind_speed: wxData.current_weather.windspeed + " km/h",
          };
        } else {
          apiData = { error: "City not found" };
        }
      } else {
        apiData = rawData;
      }
    } catch (e) {
      apiData = { error: "API call failed" };
    }
  }

  const newBalance = keyData.walletAccountId
    ? updateWalletBalance(keyData.walletAccountId, keyData.tokenId, -1)
    : await getTokenBalance(keyAccountId, keyData.tokenId);
  keyData.tokensRemaining = newBalance;
  keyData.lastUsedAt = new Date().toISOString();
  saveState();

  res.json({
    service: plan?.name,
    provider: plan?.ensName,
    data: apiData,
    tokens_remaining: newBalance,
    token_burned_on_chain: true,
    verify: `https://hashscan.io/testnet/topic/${redemptionTopicId}`,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/wallet-connected-legacy-disabled", async (req, res) => {
  const { accountId } = req.body;
  console.log(`   🔗 Wallet connected: ${accountId}`);

  // Map connected wallet to a demo account
  // In production, this would use the wallet's own signer
  if (!users["alice"]) {
    // No demo accounts exist, use the wallet directly
    demoUser = {
      accountId: AccountId.fromString(accountId),
      name: accountId,
    };
  } else {
    // For demo, associate wallet with Alice's account
    demoUser = users["alice"];
    demoUser.walletAddress = accountId;
  }

  res.json({
    connected: true,
    accountId: demoUser.accountId.toString(),
    name: demoUser.name,
  });
});

// Start server
const PORT = 3001;
init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🌐 API server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize:", err);
    process.exit(1);
  });
