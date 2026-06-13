// ============================================================
// Redeem Token
// User burns a token to get one unit of API access
// Redemption is logged to HCS for immutable audit trail
// ============================================================
import {
    TransferTransaction,
    TokenBurnTransaction,
    TopicCreateTransaction,
    TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import { getClient } from "./client.js";

// Create an HCS topic for logging all redemptions
export async function createRedemptionLog() {
    const { client } = getClient();

    const transaction = new TopicCreateTransaction()
        .setTopicMemo("AccessMint Redemption Log");

    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);

    console.log(`   ✅ Redemption log topic: ${receipt.topicId}`);
    return receipt.topicId.toString();
}

// Redeem = transfer token back to provider treasury + burn + log
export async function redeemToken({ userAccountId, userPrivateKey, providerAccountId, tokenId, topicId }) {
    const { client, privateKey: providerKey } = getClient();

    console.log(`\n🔥 Redeeming 1 token for API access...`);

    // Step 1: Transfer token back to provider
    const transferTx = new TransferTransaction()
        .addTokenTransfer(tokenId, userAccountId, -1)
        .addTokenTransfer(tokenId, providerAccountId, 1)
        .freezeWith(client);

    const signedTransfer = await (await transferTx.sign(userPrivateKey)).sign(providerKey);
    await (await signedTransfer.execute(client)).getReceipt(client);

    // Step 2: Burn the token permanently
    const burnTx = new TokenBurnTransaction()
        .setTokenId(tokenId)
        .setAmount(1)
        .freezeWith(client);

    const signedBurn = await burnTx.sign(providerKey);
    await (await signedBurn.execute(client)).getReceipt(client);

    // Step 3: Log redemption to HCS (immutable audit trail)
    const logMessage = JSON.stringify({
        action: "REDEEM",
        user: userAccountId.toString(),
        tokenId: tokenId,
        timestamp: new Date().toISOString(),
        accessGranted: true,
    });

    const logTx = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(logMessage);

    await (await logTx.execute(client)).getReceipt(client);

    console.log(`   ✅ Token burned! API access granted.`);
    console.log(`   📝 Logged to HCS topic: ${topicId}`);

    return { success: true, accessGranted: true };
}
