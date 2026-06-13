// ============================================================
// API Server
// Connects the React frontend to the Hedera backend
// Run: npm run dev (from backend folder)
// ============================================================
import express from 'express'
import cors from 'cors'
import { AccountCreateTransaction, Hbar, PrivateKey } from '@hashgraph/sdk'
import { getClient } from './hedera/client.js'
import { createAccessPlan } from './hedera/create-plan.js'
import { associateToken, buyTokens, getTokenBalance } from './hedera/buy-tokens.js'
import { createRedemptionLog, redeemToken } from './hedera/redeem-token.js'
import { createMarketplaceTopic, listForSale, buyFromMarketplace } from './hedera/marketplace.js'
import dotenv from 'dotenv'
dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// State (in-memory for hackathon)
let redemptionTopicId = null
let marketplaceTopicId = null
let demoUser = null // simulated user account
let plans = {}

// Initialize on startup
async function init() {
    console.log('🚀 Initializing AccessMint server...\n')

    const { client } = getClient()

    // Create demo user account
    const userKey = PrivateKey.generateED25519()
    const userTx = new AccountCreateTransaction()
        .setKey(userKey.publicKey)
        .setInitialBalance(new Hbar(100))
    const userResponse = await userTx.execute(client)
    const userReceipt = await userResponse.getReceipt(client)
    demoUser = { accountId: userReceipt.accountId, privateKey: userKey }
    console.log(`   ✅ Demo user: ${demoUser.accountId}`)

    // Create HCS topics
    redemptionTopicId = await createRedemptionLog()
    marketplaceTopicId = await createMarketplaceTopic()

    console.log('\n✅ Server ready!\n')
}

// POST /api/plans — Create a new access plan
app.post('/api/plans', async (req, res) => {
    try {
        const plan = await createAccessPlan(req.body)
        plans[plan.tokenId] = plan
        res.json(plan)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message })
    }
})

// POST /api/buy — Buy tokens from provider
app.post('/api/buy', async (req, res) => {
    try {
        const { tokenId, amount, pricePerTokenHbar } = req.body
        const { accountId: providerAccountId } = getClient()

        // Associate user with token (ignore error if already associated)
        try {
            await associateToken(demoUser.accountId, demoUser.privateKey, tokenId)
        } catch (e) { /* already associated */ }

        const result = await buyTokens({
            buyerAccountId: demoUser.accountId,
            buyerPrivateKey: demoUser.privateKey,
            providerAccountId,
            tokenId,
            amount,
            pricePerTokenHbar,
        })

        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message })
    }
})

// POST /api/redeem — Redeem a token for API access
app.post('/api/redeem', async (req, res) => {
    try {
        const { tokenId } = req.body
        const { accountId: providerAccountId } = getClient()

        const result = await redeemToken({
            userAccountId: demoUser.accountId,
            userPrivateKey: demoUser.privateKey,
            providerAccountId,
            tokenId,
            topicId: redemptionTopicId,
        })

        // Simulate API response
        result.apiResponse = {
            status: 200,
            data: "This is a summarized version of your document. The key points are...",
            tokensRemaining: await getTokenBalance(demoUser.accountId, tokenId),
        }

        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message })
    }
})

// POST /api/list — List tokens for resale
app.post('/api/list', async (req, res) => {
    try {
        const { tokenId, symbol, amount, pricePerTokenHbar, retailPrice } = req.body

        const listing = await listForSale({
            sellerAccountId: demoUser.accountId,
            tokenId,
            amount,
            pricePerTokenHbar,
            topicId: marketplaceTopicId,
        })

        listing.symbol = symbol
        listing.retailPrice = retailPrice
        res.json(listing)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message })
    }
})

// POST /api/marketplace/buy — Buy from marketplace
app.post('/api/marketplace/buy', async (req, res) => {
    try {
        const { listingId } = req.body

        // For demo, create a second buyer account
        const { client } = getClient()
        const buyerKey = PrivateKey.generateED25519()
        const buyerTx = new AccountCreateTransaction()
            .setKey(buyerKey.publicKey)
            .setInitialBalance(new Hbar(50))
        const buyerResponse = await buyerTx.execute(client)
        const buyerReceipt = await buyerResponse.getReceipt(client)
        const buyer = { accountId: buyerReceipt.accountId, privateKey: buyerKey }

        const result = await buyFromMarketplace({
            listingId,
            buyerAccountId: buyer.accountId,
            buyerPrivateKey: buyer.privateKey,
            sellerPrivateKey: demoUser.privateKey,
            topicId: marketplaceTopicId,
        })

        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message })
    }
})

// Start server
const PORT = 3001
init().then(() => {
    app.listen(PORT, () => {
        console.log(`🌐 API server running at http://localhost:${PORT}`)
    })
}).catch(err => {
    console.error('Failed to initialize:', err)
    process.exit(1)
})
