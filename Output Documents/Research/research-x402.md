# X402 Protocol - Research Summary

## What It Is

x402 is an **open payment protocol** by Coinbase that revives the HTTP 402 "Payment Required" status code to enable instant, programmatic, stablecoin-based payments over HTTP. Designed for both humans and autonomous AI agents to make payments without accounts, API keys, or subscriptions.

## How It Works

### Protocol Flow

1. **Client** sends a standard HTTP request (e.g., `GET /weather`)
2. **Server** responds with `402 Payment Required` + `PAYMENT-REQUIRED` header (amount, asset, destination wallet, network)
3. **Client** creates a signed `PaymentPayload` and re-sends with `PAYMENT-SIGNATURE` header
4. **Server** verifies payment (directly or via a **Facilitator**)
5. **Facilitator** submits transaction on-chain, confirms settlement
6. **Server** returns `200 OK` with the resource + `PAYMENT-RESPONSE` receipt header

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Facilitator** | Abstracts blockchain infrastructure from sellers. Handles verification + settlement. Coinbase offers a free tier (1,000 tx/month). |
| **Schemes** | `exact` (fixed amount) or `upto` (variable, pay for what you consume) |
| **ERC-3009** | Underlying standard for gasless stablecoin transfers on EVM chains |
| **Settlement** | Typically < 2 seconds. Zero protocol fees from x402 itself. |

### HTTP Headers

| Header | Direction | Purpose |
|--------|-----------|---------|
| `PAYMENT-REQUIRED` | Server → Client | Payment instructions (amount, asset, network, payTo) |
| `PAYMENT-SIGNATURE` | Client → Server | Signed payment payload |
| `PAYMENT-RESPONSE` | Server → Client | Settlement receipt |

## Who Created It

- **Creator**: Coinbase (Developer Platform team)
- **Launched**: September 2025
- **x402 Foundation**: Co-founded by Coinbase and Cloudflare. Members include Google, Visa, Stripe.
- **Stats**: 5,400+ GitHub stars, 100M+ transactions processed, 197+ contributors

## Relevance to AI Agents

x402 is built for the **agentic economy**:
- **Pay-per-use API access**: Agents pay for exactly what they consume
- **Agent-to-agent payments**: One agent pays another for services
- **Micropayments**: Sub-cent transactions previously infeasible
- **Coinbase Agentic Wallets** (Feb 2026): Specialized wallet infrastructure for autonomous agents

## Supported Networks

| Network | Status |
|---------|--------|
| **Base** (eip155:8453) | Production, gas-free via Coinbase |
| **Solana** | Production |
| **Polygon, BSC, Peaq, Sei** | Community-supported |
| **ACH, SEPA, Card** | V2 fiat support |

## SDKs

**Python** (v2.1.0):
```bash
pip install x402[all]  # Everything
pip install x402[fastapi]  # FastAPI support
pip install x402[evm]  # EVM/Ethereum support
```

**TypeScript/JavaScript**:
```bash
npm install @x402/core @x402/evm @x402/fetch  # Client
npm install @x402/core @x402/evm @x402/express  # Server
```

**Go**:
```bash
go get github.com/coinbase/x402/go
```

## Relationship to ERC-8004

| x402 | ERC-8004 |
|------|----------|
| **Payment layer** | **Identity + Trust layer** |
| How agents pay | How agents discover and trust each other |
| HTTP-native protocol | On-chain registries |

They integrate via:
- ERC-8004 registration files have an `x402Support` boolean field
- Reputation feedback includes `proofOfPayment` with x402 transaction data
- Workflow: Discover agent (8004) → Check reputation (8004) → Pay for service (x402) → Leave feedback with payment proof (8004 + x402)

## Key Links

- **Website**: [x402.org](https://www.x402.org/)
- **GitHub**: [github.com/coinbase/x402](https://github.com/coinbase/x402)
- **Docs**: [docs.cdp.coinbase.com/x402](https://docs.cdp.coinbase.com/x402/welcome)
- **Whitepaper**: [x402.org/x402-whitepaper.pdf](https://www.x402.org/x402-whitepaper.pdf)
