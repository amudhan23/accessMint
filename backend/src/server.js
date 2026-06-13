// ============================================================
// API Server
// Connects the React frontend to the Hedera backend
// Run: npm run dev (from backend folder)
// ============================================================
import express from "express";
import cors from "cors";
import { AccountCreateTransaction, Hbar, PrivateKey } from "@hashgraph/sdk";
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

// Initialize on startup
async function init() {
  console.log("🚀 Initializing AccessMint server...\n");

  const { client } = getClient();

  // Create demo user account
  const userKey = PrivateKey.generateED25519();
  const userTx = new AccountCreateTransaction()
    .setKey(userKey.publicKey)
    .setInitialBalance(new Hbar(100));
  const userResponse = await userTx.execute(client);
  const userReceipt = await userResponse.getReceipt(client);
  demoUser = { accountId: userReceipt.accountId, privateKey: userKey };
  console.log(`   ✅ Demo user: ${demoUser.accountId}`);

  // Create HCS topics
  redemptionTopicId = await createRedemptionLog();
  marketplaceTopicId = await createMarketplaceTopic();

  const plan1 = await createAccessPlan({
    name: "Crypto Price Intelligence",
    symbol: "CRYPTO",
    totalSupply: 10,
    pricePerTokenHbar: 0.1,
  });
  plan1.ensName = "cryptointel.eth";
  plan1.apiEndpoint =
    "https://api.coingecko.com/api/v3/simple/price?ids={query}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true";
  plan1.description = "Real-time crypto prices, market cap, 24h changes";
  plans[plan1.tokenId] = plan1;

  const plan2 = await createAccessPlan({
    name: "Weather Intelligence API",
    symbol: "WTHR",
    totalSupply: 10,
    pricePerTokenHbar: 0.05,
  });
  plan2.ensName = "weatherapi.eth";
  plan2.apiEndpoint =
    "https://geocoding-api.open-meteo.com/v1/search?name={query}&count=1";
  plan2.description = "Global weather data for any city";
  plans[plan2.tokenId] = plan2;

  console.log("\n✅ Server ready!\n");
}

// POST /api/plans — Create a new access plan
app.post("/api/plans", async (req, res) => {
  try {
    const plan = await createAccessPlan(req.body);
    plan.ensName = req.body.ensName || "";
    plan.apiEndpoint = req.body.apiEndpoint || "";
    plan.description = req.body.description || "";
    plans[plan.tokenId] = plan;
    console.log(`   📡 API endpoint: ${plan.apiEndpoint || "none"}`);
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/plans", (req, res) => {
  res.json(Object.values(plans));
});

// POST /api/buy — Buy tokens from provider
app.post("/api/buy", async (req, res) => {
  try {
    const { tokenId, amount, pricePerTokenHbar } = req.body;
    const { accountId: providerAccountId } = getClient();

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
      amount,
      pricePerTokenHbar,
    });

    res.json(result);
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
    res.json(listing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/marketplace/buy — Buy from marketplace
app.post("/api/marketplace/buy", async (req, res) => {
  try {
    const { listingId } = req.body;

    // For demo, create a second buyer account
    const { client } = getClient();
    const buyerKey = PrivateKey.generateED25519();
    const buyerTx = new AccountCreateTransaction()
      .setKey(buyerKey.publicKey)
      .setInitialBalance(new Hbar(50));
    const buyerResponse = await buyerTx.execute(client);
    const buyerReceipt = await buyerResponse.getReceipt(client);
    const buyer = { accountId: buyerReceipt.accountId, privateKey: buyerKey };

    const result = await buyFromMarketplace({
      listingId,
      buyerAccountId: buyer.accountId,
      buyerPrivateKey: buyer.privateKey,
      sellerPrivateKey: demoUser.privateKey,
      topicId: marketplaceTopicId,
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/verify-worldid — Verify World ID proof
app.post("/api/verify-worldid", async (req, res) => {
  try {
    const proof = req.body;

    // Verify with World ID API
    const verifyRes = await fetch(
      `https://developer.world.org/api/v2/verify/app_staging_xxxxx`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...proof,
          action: "marketplace-verify",
        }),
      },
    );

    const result = await verifyRes.json();

    if (verifyRes.ok) {
      console.log("✅ World ID verified!");
      res.json({ verified: true, nullifier_hash: result.nullifier_hash });
    } else {
      console.log("❌ World ID failed:", result);
      res.json({ verified: false, error: result });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ verified: false, error: err.message });
  }
});

// Generate RP signature for World ID
app.post("/api/rp-signature", async (req, res) => {
  try {
    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: process.env.WORLD_SIGNING_KEY,
      action: "marketplace-verify",
    });
    res.json({
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
      rp_id: process.env.WORLD_RP_ID,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Verify World ID proof
app.post("/api/verify-worldid", async (req, res) => {
  try {
    const { rp_id, idkitResponse } = req.body;
    const verifyRes = await fetch(
      `https://developer.world.org/api/v4/verify/${rp_id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idkitResponse),
      },
    );
    const result = await verifyRes.json();
    if (verifyRes.ok) {
      console.log("✅ World ID verified!");
      res.json({ verified: true });
    } else {
      res.json({ verified: false, error: result });
    }
  } catch (err) {
    res.status(500).json({ verified: false, error: err.message });
  }
});

app.post("/api/redeem", async (req, res) => {
  try {
    const { tokenId, query } = req.body;
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

    const newBalance = await getTokenBalance(demoUser.accountId, tokenId);

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

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Generate API key after buying tokens
app.post("/api/generate-key", async (req, res) => {
  const { tokenId } = req.body;
  const plan = plans[tokenId];
  const apiKey = "ak_" + Math.random().toString(36).slice(2, 15);

  apiKeys[apiKey] = {
    accountId: demoUser.accountId,
    privateKey: demoUser.privateKey,
    tokenId,
    planName: plan?.name || "Unknown",
  };

  console.log(`   🔑 API key generated: ${apiKey} → ${plan?.name}`);

  res.json({
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
  const balance = await getTokenBalance(keyData.accountId, keyData.tokenId);
  if (balance <= 0) {
    return res.status(403).json({
      error: "NO_TOKENS_REMAINING",
      message: "You have 0 tokens. Purchase more at AccessMint marketplace.",
      tokens_remaining: 0,
      marketplace: "http://localhost:5173/marketplace",
    });
  }

  // Burn 1 token
  const { accountId: providerAccountId } = getClient();
  await redeemToken({
    userAccountId: keyData.accountId,
    userPrivateKey: keyData.privateKey,
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

  const newBalance = await getTokenBalance(keyData.accountId, keyData.tokenId);

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
