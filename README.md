# AccessMint

AccessMint is a tokenized API access marketplace built on Hedera. Providers mint API calls as finite Hedera Token Service (HTS) access tokens, users buy only the calls they need, and unused calls can be resold in a secondary market instead of expiring or sitting idle.

> Demo video: https://example.com/accessmint-demo-video

## Problem

API access is usually sold through subscriptions, prepaid credits, and usage packages. That creates a broken market:

- Users overbuy API credits because exact usage is hard to forecast.
- Unused credits expire or become stranded inside one account.
- Smaller developers cannot easily buy discounted access from people who no longer need it.
- Providers have no standard way to make API credits transferable, auditable, and resale-friendly.

In short: unused API credits are wasted, and no resale market exists for API access.

## Solution

AccessMint turns API calls into transferable access tokens.

1. A provider lists an API plan and mints a finite HTS token supply.
2. A buyer connects a Hedera wallet through WalletConnect.
3. The buyer purchases API access tokens with HBAR.
4. AccessMint generates an API key tied to that wallet-owned token balance.
5. Each API call burns or redeems one token and records proof through Hedera.
6. Unused tokens can be listed on the secondary marketplace at a discount.
7. Secondary buyers verify with World ID before buying resale tokens.
8. Providers can attach ENS names so API identity is human-readable and searchable.

The result is a more liquid API access market: providers get upfront revenue, buyers recover value from unused calls, and secondary buyers get cheaper access.

## Key Features

- HTS tokenized API credits on Hedera testnet.
- No Solidity smart contracts; the app uses Hedera native services and the Hedera JavaScript SDK.
- HCS audit trails for marketplace listings and token redemptions.
- WalletConnect login with wallet-scoped sessions and optional signed nonce verification.
- World ID backend verification for human-gated resale market access.
- ENS provider identity, ENS profile links, and `.eth` provider search.
- API key issuance after token purchase.
- API call metering through `POST /v1/call`.
- Wallet-specific balances that persist across refreshes through `backend/state.json`.
- Secondary marketplace for discounted resale of unused API calls.
- Hedera proof drawer in My APIs with token ID, HashScan links, HCS topic, provider ENS, and remaining balance.

## Tech Stack

### Blockchain and Identity

- Hedera Token Service (HTS) for fungible access tokens.
- Hedera Consensus Service (HCS) for redemption and marketplace audit logs.
- Hedera JavaScript SDK for account, token, transfer, burn, and topic operations.
- WalletConnect through `@hashgraph/hedera-wallet-connect`.
- World ID through `@worldcoin/idkit` and backend proof verification.
- ENS resolution through `viem` on Ethereum mainnet.

### Frontend

- React 19
- Vite
- Tailwind CSS
- Lucide React icons
- React Router DOM

### Backend

- Node.js
- Express
- Hedera SDK
- World ID IDKit core signing
- File-backed demo state in `backend/state.json`

## Architecture Overview

```text
HashPack / WalletConnect
        |
        v
React + Vite frontend (localhost:5173)
        |
        | Vite proxy: /api -> localhost:3001
        v
Express backend (localhost:3001)
        |
        +-- Wallet auth sessions
        +-- API plan registry
        +-- API key registry
        +-- Wallet token balances
        +-- Secondary listings
        +-- World ID proof verification
        |
        v
Hedera testnet
        |
        +-- HTS access token minting and transfers
        +-- HTS token burn/redeem flow
        +-- HCS redemption topic
        +-- HCS marketplace topic
        |
        v
External provider APIs
        |
        +-- CoinGecko crypto price API
        +-- Open-Meteo weather API
```

### Frontend Flow

- `ExplorePage.jsx`: Browse provider APIs, search by text or ENS name, buy access tokens, and generate API keys.
- `UserPage.jsx`: View owned API access, copy API keys, call APIs, burn tokens, list unused tokens for resale, and inspect Hedera proof details.
- `MarketplacePage.jsx`: Search/sort resale listings, verify with World ID, and buy discounted secondary tokens.
- `ProviderPage.jsx`: Create new API access plans with symbol, supply, price, endpoint, description, and ENS name.
- `WalletConnect.jsx`: Connects HashPack via WalletConnect, restores sessions, and optionally signs a nonce for wallet authentication.
- `WorldIDVerify.jsx`: Requests World ID RP context from the backend, opens IDKit, and sends proofs to the backend for verification.
- `ENSIntegration.jsx` and `ensResolver.js`: Normalize ENS names, resolve ENS records, and link to ENS profiles.

### Backend Flow

- `POST /api/plans`: Create a new provider API plan and mint an HTS token.
- `GET /api/plans`: Return all available API plans.
- `POST /api/auth/nonce`: Create a wallet authentication challenge.
- `POST /api/auth/verify`: Verify a wallet signature and create a session.
- `POST /api/auth/walletconnect-session`: Create a WalletConnect-backed session for demo mode.
- `GET /api/auth/session`: Validate an existing wallet session.
- `GET /api/wallet-state`: Return wallet-owned balances and API keys.
- `POST /api/buy`: Buy provider-issued access tokens.
- `POST /api/generate-key`: Generate an API key for a wallet that owns tokens.
- `POST /api/redeem`: Redeem one token from inside the app and call the provider API.
- `POST /v1/call`: Public API gateway endpoint. Requires `Authorization: Bearer <api_key>`.
- `POST /api/list`: List unused tokens for resale.
- `GET /api/listings`: Return secondary listings.
- `POST /api/marketplace/buy`: Buy a resale listing.
- `POST /api/rp-signature`: Create signed World ID request context.
- `POST /api/verify-worldid`: Verify World ID proof on the backend.

## Repository Structure

```text
ethGlobalHack/
  backend/
    src/
      hedera/
        buy-tokens.js
        client.js
        create-plan.js
        marketplace.js
        redeem-token.js
      demo/
        full-demo.js
      server.js
    package.json
    state.json
  frontend/
    src/
      components/
        ActivityLog.jsx
        ENSIntegration.jsx
        WalletConnect.jsx
        WorldIDVerify.jsx
        ensResolver.js
        walletContext.js
      pages/
        ExplorePage.jsx
        MarketplacePage.jsx
        ProviderPage.jsx
        UserPage.jsx
      App.jsx
      main.jsx
    package.json
    vite.config.js
```

## Environment Variables

Create separate `.env` files for the backend and frontend. Do not commit real private keys or signing keys.

### `backend/.env.example`

```bash
# Hedera testnet operator account.
# Create one at https://portal.hedera.com/
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_PRIVATE_KEY=0xYOUR_ECDSA_PRIVATE_KEY
HEDERA_NETWORK=testnet

# World ID configuration.
# Create the app and action in the World developer portal.
WORLD_RP_ID=rp_YOUR_RELYING_PARTY_ID
WORLD_APP_ID=app_YOUR_WORLD_APP_ID
WORLD_ID_ACTION=marketplaceverify
WORLD_ID_ENVIRONMENT=staging
WORLD_SIGNING_KEY=YOUR_WORLD_ID_SIGNING_KEY

# World verification endpoints.
# v4 verification uses developer.world.org.
WORLD_ID_VERIFY_BASE_URL=https://developer.world.org

# Optional legacy fallback for older staging/simulator proofs.
WORLD_ID_V2_VERIFY_BASE_URLS=https://developer.worldcoin.org,https://developer.world.org
```

### `frontend/.env.example`

```bash
# Must match the World app/action used by the backend.
VITE_WORLD_APP_ID=app_YOUR_WORLD_APP_ID
VITE_WORLD_RP_ID=rp_YOUR_RELYING_PARTY_ID
VITE_WORLD_ID_ACTION=marketplaceverify
VITE_WORLD_ID_ENVIRONMENT=staging

# Set to true to require signed nonce wallet authentication.
# If false or omitted, the app uses a WalletConnect session flow for demo convenience.
VITE_REQUIRE_WALLET_SIGNATURE=false
```

## Setup

### Prerequisites

- Node.js 20 or later recommended.
- npm.
- Hedera testnet account with HBAR.
- HashPack wallet configured for Hedera testnet.
- World developer portal app and action for `marketplaceverify`.

### Backend

From the backend folder:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

The backend starts at:

```text
http://localhost:3001
```

On first start, the server creates demo buyer accounts, two default API plans, HTS access tokens, and fresh HCS topics. State is saved to:

```text
backend/state.json
```

Delete `backend/state.json` if you want to reset the hackathon demo state.

### Frontend

From the frontend folder:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend starts at:

```text
http://localhost:5173
```

Vite proxies `/api` requests to:

```text
http://localhost:3001
```

## Running the Demo

1. Start the backend on `localhost:3001`.
2. Start the frontend on `localhost:5173`.
3. Open the app in the browser.
4. Connect HashPack on Hedera testnet.
5. Buy API access tokens from Explore.
6. Open My APIs and copy the generated API key.
7. Call the gateway endpoint:

```bash
curl -X POST http://localhost:3001/v1/call \
  -H "Authorization: Bearer ak_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"bitcoin"}'
```

8. Confirm one token was consumed and the remaining balance changed.
9. List unused tokens for resale from My APIs.
10. Open Marketplace, verify with World ID, and buy a discounted listing from another wallet/account.
11. Use the purchased API key to confirm resale tokens also grant API access.
12. Open the Hedera Proof drawer in My APIs to inspect token, HCS, provider, and balance proof details.

You can also run the backend script-only demo:

```bash
cd backend
npm run demo
```

## Demo API Services

AccessMint ships with two default providers for the hackathon demo:

- Crypto Price Intelligence: wraps CoinGecko crypto price data.
- Weather Intelligence API: wraps Open-Meteo geocoding and weather data.

Providers can add more services through the List API tab by entering an API name, token symbol, supply, price, ENS name, and endpoint template. Endpoints can include `{query}`, which is replaced with the user request.

## Prize Tracks

AccessMint is designed for the following ETHGlobal prize tracks:

### Hedera Tokenization

AccessMint tokenizes API access as finite HTS fungible tokens. Each token represents one callable unit of API access, and marketplace purchases transfer token ownership.

### Hedera No Solidity Allowed

The project uses Hedera native services through the Hedera JavaScript SDK. Token creation, association, transfers, burns, and HCS messages are handled without Solidity smart contracts.

### World ID Track B

The secondary marketplace is gated by World ID. The frontend collects an IDKit proof and the backend verifies it through the World ID verification API before enabling resale purchases.

### ENS Integrate ENS

Providers can attach ENS names to API listings. Explore search supports both normal text search and `.eth` ENS lookup, and each API card links to the provider ENS profile.

## Security and Production Notes

This is a hackathon-grade implementation with production-minded boundaries:

- Wallet state is scoped to authenticated wallet sessions.
- Buying, redeeming, listing, and marketplace purchases require wallet auth.
- World ID proof validation happens on the backend.
- API keys are checked server-side before API calls are allowed.
- Token balances are persisted in `backend/state.json` for demo continuity.

For production, the next steps would be:

- Replace `state.json` with Postgres, Redis, or another durable database.
- Move API key storage to hashed credentials.
- Add rate limits and API key rotation.
- Harden WalletConnect signed-message auth as the default path.
- Persist HCS topic IDs instead of recreating them on every server restart.
- Add listing cancellation and partial-fill support.
- Add provider payout accounting and admin tooling.

## Useful Commands

Backend:

```bash
npm run dev
npm run demo
```

Frontend:

```bash
npm run dev
npm run lint
npm run build
npm run preview
```

## License

Hackathon prototype. Add a license before production release.
