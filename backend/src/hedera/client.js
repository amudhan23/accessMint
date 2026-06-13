// ============================================================
// Hedera Client Setup
// Connects to Hedera testnet using your credentials
// ============================================================
import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";
import dotenv from "dotenv";
dotenv.config();

export function getClient() {
  const accountId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
  // Use fromStringECDSA for portal-generated ECDSA keys
  // Use fromStringDer if you have a DER-encoded key instead
  const privateKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY);

  const client = Client.forTestnet();
  client.setOperator(accountId, privateKey);

  return { client, accountId, privateKey };
}
