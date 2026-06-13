# AccessMint

**Tokenized API access — buy credits, use what you need, resell what you don't.**

Built at ETHGlobal NYC 2026.

## The Problem

Billions of dollars in API credits, SaaS subscriptions, and compute access 
go unused every year. Once you buy a subscription, your only options are 
"keep paying" or "cancel." There's no way to resell unused access.

## The Solution

AccessMint lets service providers mint access tokens on Hedera using HTS. 
Users buy tokens, burn them for access, and resell unused tokens on a 
trustless marketplace. Providers get upfront revenue. Buyers recover 
money they'd otherwise lose. Secondary buyers get discounted access.

## How It Works

1. Provider creates an access plan → mints tokens via Hedera Token Service
2. Users buy tokens with HBAR
3. Users redeem (burn) tokens → provider backend grants access
4. Users list unused tokens on marketplace at any price
5. Other users buy discounted tokens from marketplace
6. All transfers are trustless, on-chain, instant

## Tech Stack

- Hedera Token Service (HTS) — native token minting/transfer
- Hedera Consensus Service (HCS) — marketplace listings and reputation logs
- Hedera JavaScript SDK — no Solidity, no smart contracts
- React frontend
- Node.js backend (simulated API provider)

## Setup

```bash
npm install
cp .env.example .env
# Add your Hedera testnet credentials to .env
npm run setup    # Creates accounts and tokens
npm run demo     # Runs the full demo flow
npm run dev      # Starts the server
```

## Prize Tracks

- Hedera: Tokenization on Hedera ($3,000)
- Hedera: "No Solidity Allowed" ($3,000)
- World: World ID Track B ($2,500)
- ENS: Integrate ENS ($6,000 pool)
