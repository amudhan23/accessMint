// ============================================================
// Buy Tokens
// User purchases access tokens from the provider
// Atomic swap: tokens go to buyer, HBAR goes to provider
// ============================================================
import {
    TransferTransaction,
    AccountBalanceQuery,
    TokenAssociateTransaction,
    Hbar,
} from "@hashgraph/sdk";
import { getClient } from "./client.js";

// Before receiving tokens, user must "associate" with the token type
// This is a Hedera security feature — prevents spam tokens
export async function associateToken(userAccountId, userPrivateKey, tokenId) {
    const { client } = getClient();

    const transaction = new TokenAssociateTransaction()
        .setAccountId(userAccountId)
        .setTokenIds([tokenId])
        .freezeWith(client);

    const signedTx = await transaction.sign(userPrivateKey);
    const response = await signedTx.execute(client);
    await response.getReceipt(client);

    console.log(`   ✅ User ${userAccountId} associated with token ${tokenId}`);
}

// Atomic swap: tokens from provider to buyer, HBAR from buyer to provider
export async function buyTokens({ buyerAccountId, buyerPrivateKey, providerAccountId, tokenId, amount, pricePerTokenHbar }) {
    const { client, privateKey: providerKey } = getClient();
    const totalCost = amount * pricePerTokenHbar;

    console.log(`\n💰 Buying ${amount} tokens for ${totalCost} HBAR...`);

    const transaction = new TransferTransaction()
        .addTokenTransfer(tokenId, providerAccountId, -amount)
        .addTokenTransfer(tokenId, buyerAccountId, amount)
        .addHbarTransfer(buyerAccountId, new Hbar(-totalCost))
        .addHbarTransfer(providerAccountId, new Hbar(totalCost))
        .freezeWith(client);

    const signedTx = await (await transaction.sign(providerKey)).sign(buyerPrivateKey);
    const response = await signedTx.execute(client);
    await response.getReceipt(client);

    console.log(`   ✅ ${amount} tokens purchased!`);
    return { amount, totalCost, tokenId };
}

// Check token balance for any account
export async function getTokenBalance(accountId, tokenId) {
    const { client } = getClient();
    const balance = await new AccountBalanceQuery()
        .setAccountId(accountId)
        .execute(client);

    const tokenBalance = balance.tokens._map.get(tokenId.toString());
    return tokenBalance ? tokenBalance.toNumber() : 0;
}
