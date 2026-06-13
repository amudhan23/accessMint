# AccessMint UI Redesign Spec

## Tech Stack
- React + Vite
- Tailwind CSS (dark theme, bg-gray-950 base)
- lucide-react for icons
- Backend API runs on localhost:3001

## Color Palette
- Background: gray-950, gray-900, gray-800
- Primary/Success: mint/green (#22c55e range)
- Accent Blue: blue-500/600
- Accent Orange: orange-500/600 (for token burns)
- Accent Purple: purple-500/600 (for resale)
- Text: white, gray-400, gray-500

## App Structure — 4 Tabs

### Tab 1: "Explore" (replaces Provider)
PURPOSE: Browse all available API services. Any user can see what's available.

LAYOUT:
- Header: "API Marketplace" with subtitle "Discover and purchase tokenized API access"
- Filter bar: search input + sort dropdown (Price: Low to High, Price: High to Low, Newest)
- Grid of API cards (2 columns on desktop, 1 on mobile)

API CARD DESIGN:
```
┌─────────────────────────────────────────────┐
│  📊  Crypto Price Intelligence              │
│  Real-time crypto prices, market cap, 24h   │
│  changes                                     │
│                                              │
│  Provider: cryptointel.eth                   │
│  Token: CRYPTO · 0.0.9225298                │
│                                              │
│  ┌──────┐  ┌──────────┐  ┌────────────────┐ │
│  │0.1 ℏ │  │ 50 avail │  │ [Buy 5] [0.5ℏ]│ │
│  │/call  │  │          │  │                │ │
│  └──────┘  └──────────┘  └────────────────┘ │
└─────────────────────────────────────────────┘
```

Each card has:
- Icon (📊 for crypto, 🌤️ for weather, etc)
- Name + description
- Provider ENS name
- Price per call in HBAR
- Available supply
- Inline buy: number input + buy button showing cost

ENDPOINTS:
- GET /api/plans → returns array of plans

### Tab 2: "My APIs" (replaces Dashboard)
PURPOSE: Show ONLY the APIs the user has purchased tokens for. This is their personal dashboard.

LAYOUT:
- Header: "My APIs" with subtitle "Manage your purchased API access"
- If no tokens owned: empty state "You haven't purchased any API access yet. Browse the Explore tab to get started."
- List of purchased APIs with token balances

PURCHASED API CARD:
```
┌─────────────────────────────────────────────┐
│  📊  Crypto Price Intelligence     3 CRYPTO │
│  Provider: cryptointel.eth                   │
│                                              │
│  🔑 API Key: ak_f0n5r5d6kef    [Copy]       │
│                                              │
│  ┌─ Try it ─────────────────────────────┐   │
│  │ Enter query: [bitcoin          ]     │   │
│  │ [🔥 Burn 1 Token → Call API]         │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  {API response shown here after call}        │
│                                              │
│  [📋 Sell Tokens]  ← opens modal             │
└─────────────────────────────────────────────┘
```

SELL MODAL (popup when clicking "Sell Tokens"):
```
┌─────────────────────────────────────────────┐
│         Sell CRYPTO Tokens                   │
│                                              │
│  You have: 3 CRYPTO tokens                  │
│                                              │
│  Amount to sell: [2        ]                │
│  Price per token: [0.07    ] HBAR           │
│                                              │
│  Retail price: 0.10 HBAR                    │
│  Your price: 0.07 HBAR (30% discount)       │
│  Total: 0.14 HBAR                           │
│                                              │
│  [Cancel]  [List on Marketplace]             │
└─────────────────────────────────────────────┘
```

ENDPOINTS:
- GET /api/plans → filter to show only plans where user has tokens
- POST /api/redeem → { tokenId, query } → burns token, returns API response
- POST /api/list → { tokenId, symbol, amount, pricePerTokenHbar, retailPrice, ensName }

STATE:
- userTokens object: { tokenId: balance }
- Only show APIs where userTokens[plan.tokenId] > 0

### Tab 3: "Marketplace" (stays similar but improved)
PURPOSE: Buy discounted tokens from other users. Protected by World ID.

LAYOUT:
- Header: "Secondary Market" with subtitle "Buy discounted API tokens from other users"
- Stats bar: Active Listings | Total Sold | Best Discount
- World ID gate (existing WorldIDVerify component)
- List of active listings
- "Recently Sold" section at bottom

LISTING CARD:
```
┌─────────────────────────────────────────────┐
│  🛒  2 CRYPTO Tokens                        │
│  Token ID: 0.0.9225298                      │
│  Provider: cryptointel.eth                   │
│  Seller: Alice                               │
│                                              │
│  Retail: 0.20 HBAR  →  0.14 HBAR (30% off) │
│  Save: 0.06 HBAR                            │
│                                              │
│  [Buy Now]                                   │
└─────────────────────────────────────────────┘
```

After buying, show API key card (same as existing).

### Tab 4: "List API" (new, for providers)
PURPOSE: Providers register their API and mint access tokens.

LAYOUT:
- Header: "List Your API" with subtitle "Mint access tokens and start earning"
- Single form card
- "Your Listed APIs" section below showing existing plans

FORM:
```
┌─────────────────────────────────────────────┐
│  + List Your API                             │
│                                              │
│  API Name: [                        ]        │
│  Token Symbol: [      ]  Supply: [     ]     │
│  Price per call (HBAR): [         ]          │
│  Your ENS Name: [              ] (optional)  │
│  API Endpoint URL: [                    ]    │
│  Use {query} as placeholder                  │
│  Description: [                         ]    │
│                                              │
│  This will mint X tokens on Hedera using HTS │
│  Total revenue at full sale: X.XX HBAR       │
│                                              │
│  [Create Access Plan]                        │
└─────────────────────────────────────────────┘
```

## Header Component
```
┌─────────────────────────────────────────────────────────┐
│ 🪙 AccessMint                    👩 Alice 👨 Bob  Testnet│
│ Tokenized API Access on Hedera                          │
├─────────────────────────────────────────────────────────┤
│ ⚡ Explore  💰 My APIs  🏪 Marketplace  📝 List API     │
└─────────────────────────────────────────────────────────┘
```

## Activity Feed (right sidebar)
- Stays as-is
- Shows all transaction activity
- Each entry links to Hashscan

## Important Notes for Implementation
- All state is managed in App.jsx and passed as props
- Backend runs on localhost:3001, frontend proxies /api calls via vite config
- Use existing WorldIDVerify component for marketplace gate
- Use existing ENSIntegration components for ENS display
- Dark theme throughout, rounded-2xl for cards, rounded-xl for inputs
- Loading states: show "Buying...", "Calling API...", etc on buttons
- All amounts in HBAR
- Token IDs shown in mono font
