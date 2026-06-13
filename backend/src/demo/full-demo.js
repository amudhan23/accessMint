// ============================================================
// FULL DEMO: AccessMint End-to-End Flow
// 
// This script demonstrates the entire lifecycle:
// 1. Provider creates an access plan (mints tokens)
// 2. Alice buys 100 tokens
// 3. Alice redeems 60 tokens (makes 60 API calls)
// 4. Alice lists remaining 40 tokens on marketplace at 30% discount
// 5. Bob buys Alice's discounted tokens from marketplace
// 6. Bob redeems tokens for API access
//
// Run: npm run demo
// ============================================================
import { AccountCreateTransaction, Hbar, PrivateKey } from "@hashgraph/sdk";
import { getClient } from "../hedera/client.js";
import { createAccessPlan } from "../hedera/create-plan.js";
import { associateToken, buyTokens, getTokenBalance } from "../hedera/buy-tokens.js";
import { createRedemptionLog, redeemToken } from "../hedera/redeem-token.js";
import { createMarketplaceTopic, listForSale, buyFromMarketplace } from "../hedera/marketplace.js";

async function createTestAccount(name) {
    const { client } = getClient();
    const newKey = PrivateKey.generateED25519();

    const transaction = new AccountCreateTransaction()
        .setKey(newKey.publicKey)
        .setInitialBalance(new Hbar(50)); // Fund with testnet HBAR

    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);

    console.log(`   ✅ ${name}: ${receipt.accountId}`);
    return { accountId: receipt.accountId, privateKey: newKey };
}

async function main() {
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║           AccessMint — Full Demo                ║");
    console.log("║  Tokenized API Access: Buy, Use, Resell         ║");
    console.log("╚══════════════════════════════════════════════════╝");

    // ── Setup ──────────────────────────────────────────────
    console.log("\n📦 SETUP: Creating test accounts...\n");

    const alice = await createTestAccount("Alice (buyer)");
    const bob = await createTestAccount("Bob (secondary buyer)");

    const { accountId: providerAccountId } = getClient();
    console.log(`   ✅ Provider: ${providerAccountId}`);

    // Create HCS topics for logging
    console.log("\n📝 Creating audit logs...\n");
    const redemptionTopicId = await createRedemptionLog();
    const marketplaceTopicId = await createMarketplaceTopic();

    // ── Step 1: Provider creates access plan ───────────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 1: Provider creates an API access plan");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const plan = await createAccessPlan({
        name: "AI Summarizer API — 1000 Calls",
        symbol: "AISUM",
        totalSupply: 1000,
        pricePerTokenHbar: 0.10, // 0.10 HBAR per API call
    });

    // ── Step 2: Alice buys 100 tokens ──────────────────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 2: Alice buys 100 access tokens");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    await associateToken(alice.accountId, alice.privateKey, plan.tokenId);

    await buyTokens({
        buyerAccountId: alice.accountId,
        buyerPrivateKey: alice.privateKey,
        providerAccountId,
        tokenId: plan.tokenId,
        amount: 100,
        pricePerTokenHbar: plan.pricePerTokenHbar,
    });

    let aliceBalance = await getTokenBalance(alice.accountId, plan.tokenId);
    console.log(`   Alice's token balance: ${aliceBalance}`);

    // ── Step 3: Alice uses 60 tokens (makes API calls) ────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 3: Alice redeems tokens for API access");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Redeem 3 tokens for demo (in real demo, show more)
    for (let i = 1; i <= 3; i++) {
        console.log(`\n   --- API Call ${i}/3 ---`);
        await redeemToken({
            userAccountId: alice.accountId,
            userPrivateKey: alice.privateKey,
            providerAccountId,
            tokenId: plan.tokenId,
            topicId: redemptionTopicId,
        });
    }

    aliceBalance = await getTokenBalance(alice.accountId, plan.tokenId);
    console.log(`\n   Alice's remaining balance: ${aliceBalance} tokens`);
    console.log(`   Alice used 3 tokens, has 97 left`);

    // ── Step 4: Alice lists unused tokens on marketplace ───
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 4: Alice lists 40 unused tokens at 30% discount");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const listing = await listForSale({
        sellerAccountId: alice.accountId,
        tokenId: plan.tokenId,
        amount: 40,
        pricePerTokenHbar: 0.07, // 30% discount from 0.10 retail
        topicId: marketplaceTopicId,
    });

    console.log(`   Retail price: 0.10 HBAR/token`);
    console.log(`   Alice's price: 0.07 HBAR/token (30% off!)`);

    // ── Step 5: Bob buys from marketplace ──────────────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 5: Bob buys discounted tokens from marketplace");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    await associateToken(bob.accountId, bob.privateKey, plan.tokenId);

    await buyFromMarketplace({
        listingId: listing.id,
        buyerAccountId: bob.accountId,
        buyerPrivateKey: bob.privateKey,
        sellerPrivateKey: alice.privateKey,
        topicId: marketplaceTopicId,
    });

    const bobBalance = await getTokenBalance(bob.accountId, plan.tokenId);
    console.log(`   Bob's token balance: ${bobBalance}`);
    console.log(`   Bob saved: ${(40 * 0.03).toFixed(2)} HBAR (30% off retail)`);

    // ── Step 6: Bob redeems tokens ─────────────────────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 6: Bob uses his discounted tokens for API access");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    await redeemToken({
        userAccountId: bob.accountId,
        userPrivateKey: bob.privateKey,
        providerAccountId,
        tokenId: plan.tokenId,
        topicId: redemptionTopicId,
    });

    // ── Summary ────────────────────────────────────────────
    const finalAlice = await getTokenBalance(alice.accountId, plan.tokenId);
    const finalBob = await getTokenBalance(bob.accountId, plan.tokenId);

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║                 DEMO SUMMARY                    ║");
    console.log("╠══════════════════════════════════════════════════╣");
    console.log(`║  Provider earned:   10 HBAR (100 tokens sold)   ║`);
    console.log(`║  Alice spent:       10 HBAR on 100 tokens       ║`);
    console.log(`║  Alice used:        3 tokens (3 API calls)      ║`);
    console.log(`║  Alice resold:      40 tokens at 0.07 HBAR each ║`);
    console.log(`║  Alice recovered:   2.80 HBAR                   ║`);
    console.log(`║  Alice still has:   ${finalAlice} tokens                    ║`);
    console.log(`║  Bob bought:        40 tokens at 30% discount   ║`);
    console.log(`║  Bob saved:         1.20 HBAR vs retail         ║`);
    console.log(`║  Bob used:          1 token (1 API call)        ║`);
    console.log(`║  Bob still has:     ${finalBob} tokens                    ║`);
    console.log("╠══════════════════════════════════════════════════╣");
    console.log("║  Everyone wins. No access wasted.               ║");
    console.log("╚══════════════════════════════════════════════════╝");

    console.log("\n🔍 Audit trail on HCS:");
    console.log(`   Redemptions: https://hashscan.io/testnet/topic/${redemptionTopicId}`);
    console.log(`   Marketplace: https://hashscan.io/testnet/topic/${marketplaceTopicId}`);
}

main().catch(console.error);
