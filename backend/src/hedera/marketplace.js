// ============================================================
// Marketplace
// Users list unused tokens for resale
// Other users buy at discounted prices
// All activity logged to HCS for transparency
// ============================================================
import {
  TransferTransaction,
  TopicMessageSubmitTransaction,
  TopicCreateTransaction,
  Hbar,
} from "@hashgraph/sdk";
import { getClient } from "./client.js";

// In-memory listings (hackathon MVP)
// Production: use HCS messages + Mirror Node queries
const listings = [];

export async function createMarketplaceTopic() {
  const { client } = getClient();

  const transaction = new TopicCreateTransaction().setTopicMemo(
    "AccessMint Marketplace",
  );

  const response = await transaction.execute(client);
  const receipt = await response.getReceipt(client);

  console.log(`   ✅ Marketplace topic: ${receipt.topicId}`);
  return receipt.topicId.toString();
}

export async function listForSale({
  sellerAccountId,
  tokenId,
  amount,
  pricePerTokenHbar,
  topicId,
}) {
  console.log(
    `\n📋 Listing ${amount} tokens at ${pricePerTokenHbar} HBAR each...`,
  );

  const listing = {
    id: listings.length + 1,
    seller: sellerAccountId.toString(),
    tokenId: tokenId.toString(),
    amount,
    pricePerTokenHbar,
    active: true,
    createdAt: new Date().toISOString(),
  };

  listings.push(listing);

  // Log to HCS
  const { client } = getClient();
  const logTx = new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify({ action: "LIST_FOR_SALE", ...listing }));

  await (await logTx.execute(client)).getReceipt(client);

  console.log(`   ✅ Listed! ID: ${listing.id}`);
  return listing;
}

export async function buyFromMarketplace({
  listingId,
  buyerAccountId,
  buyerPrivateKey,
  sellerPrivateKey,
  topicId,
}) {
  const listing = listings.find((l) => l.id === listingId && l.active);
  if (!listing) throw new Error("Listing not found or inactive");

  const { client } = getClient();
  const totalCost = listing.amount * listing.pricePerTokenHbar;

  console.log(`\n🛒 Buying ${listing.amount} tokens from marketplace...`);
  console.log(
    `   Price: ${listing.pricePerTokenHbar} HBAR each (${totalCost} HBAR total)`,
  );

  // Atomic swap: tokens from seller → buyer, HBAR from buyer → seller
  const transaction = new TransferTransaction()
    .addTokenTransfer(listing.tokenId, listing.seller, -listing.amount)
    .addTokenTransfer(listing.tokenId, buyerAccountId, listing.amount)
    .addHbarTransfer(
      buyerAccountId,
      new Hbar(-Math.round(totalCost * 100000000) / 100000000),
    )
    .addHbarTransfer(
      listing.seller,
      new Hbar(Math.round(totalCost * 100000000) / 100000000),
    )
    .freezeWith(client);

  const signedTx = await (
    await transaction.sign(sellerPrivateKey)
  ).sign(buyerPrivateKey);
  const response = await signedTx.execute(client);
  await response.getReceipt(client);

  listing.active = false;

  // Log sale to HCS
  const logTx = new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(
      JSON.stringify({
        action: "MARKETPLACE_SALE",
        listingId,
        buyer: buyerAccountId.toString(),
        totalCost,
        timestamp: new Date().toISOString(),
      }),
    );

  await (await logTx.execute(client)).getReceipt(client);

  console.log(`   ✅ Purchased from marketplace!`);
  return { amount: listing.amount, totalCost };
}

export function getActiveListings() {
  return listings.filter((l) => l.active);
}
