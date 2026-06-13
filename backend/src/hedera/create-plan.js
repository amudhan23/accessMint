// ============================================================
// Create Access Plan
// Provider mints access tokens using Hedera Token Service
// Each token = 1 unit of API access (1 API call)
// ============================================================
import {
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
} from "@hashgraph/sdk";
import { getClient } from "./client.js";

export async function createAccessPlan({ name, symbol, totalSupply, pricePerTokenHbar }) {
    const { client, accountId, privateKey } = getClient();

    console.log(`\n🏭 Creating access plan: ${name}`);
    console.log(`   Total supply: ${totalSupply} tokens`);
    console.log(`   Price per token: ${pricePerTokenHbar} HBAR`);

    // Create a fungible token on Hedera Token Service
    // No Solidity needed — this is a native Hedera operation
    const transaction = new TokenCreateTransaction()
        .setTokenName(name)
        .setTokenSymbol(symbol)
        .setTokenType(TokenType.FungibleCommon)
        .setDecimals(0)                     // Each token = 1 whole unit
        .setInitialSupply(totalSupply)
        .setSupplyType(TokenSupplyType.Finite)
        .setMaxSupply(totalSupply)
        .setTreasuryAccountId(accountId)    // Provider holds all tokens initially
        .setAdminKey(privateKey)
        .setSupplyKey(privateKey)
        .freezeWith(client);

    const signedTx = await transaction.sign(privateKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);

    const tokenId = receipt.tokenId;
    console.log(`   ✅ Token ID: ${tokenId}`);

    return {
        tokenId: tokenId.toString(),
        name,
        symbol,
        totalSupply,
        pricePerTokenHbar,
        provider: accountId.toString(),
    };
}
