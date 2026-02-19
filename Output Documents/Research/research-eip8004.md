# ERC-8004: Trustless Agents - Research Summary

## What It Is

ERC-8004 ("Trustless Agents") is an Ethereum standard that provides **on-chain identity, reputation, and validation infrastructure** for autonomous AI agents. It enables agents to discover, authenticate, and interact with each other across organizational boundaries without pre-existing trust.

- **Status**: Draft (Standards Track: ERC)
- **Created**: August 13, 2025
- **Mainnet**: Live on Ethereum since January 29, 2026
- **Adoption**: ~10,000 agents registered on-chain as of early Feb 2026

## Authors

- Marco De Rossi (MetaMask/Consensys)
- Davide Crapis (Ethereum Foundation)
- Jordan Ellis (Google)
- Erik Reppel (Coinbase)

## Three Core Registries

### 1. Identity Registry

An **ERC-721 (NFT)** contract where each agent is a transferable NFT with a unique `agentId`.

- **Global Agent ID format**: `{namespace}:{chainId}:{identityRegistry}`
- Token URI points to a **Registration File** describing capabilities and endpoints
- `agentWallet` mechanism separates agent's payment address from owner's address
- Wallet automatically cleared on NFT transfer (forces re-verification)

**Registration File** includes:
```json
{
  "name": "myAgent",
  "description": "What the agent does",
  "services": [
    { "name": "A2A", "endpoint": "https://agent.example/.well-known/agent-card.json" },
    { "name": "MCP", "endpoint": "https://mcp.agent.eth/" }
  ],
  "x402Support": true,
  "active": true,
  "supportedTrust": ["reputation", "crypto-economic", "tee-attestation"]
}
```

### 2. Reputation Registry

Standardized feedback interface for rating agents:
- Agents must cryptographically authorize clients to give feedback (anti-spam)
- Feedback uses `int128` with configurable decimals for scores, percentages, durations
- Supports revocation and agent responses
- Self-feedback from owners/operators is prevented

### 3. Validation Registry

Independent verification hooks:
- Agents request validation from designated validator contracts
- Responses range 0-100 (binary pass/fail or quality spectrum)
- Supports TEE attestation, zkML proofs, crypto-economic validation

## Trust Models

The `supportedTrust` field declares which mechanisms an agent supports:
- **reputation** - Client feedback via Reputation Registry
- **crypto-economic** - Stake-secured re-execution
- **tee-attestation** - Trusted Execution Environment verification
- **zkML** - Zero-knowledge machine learning proofs

## Deployed Networks (16+)

Ethereum, **Base**, Arbitrum, Optimism, Polygon, Scroll, Linea, Abstract, Avalanche, Celo, Gnosis, Mantle, MegaETH, Taiko, Monad, BSC

**Known Contract Addresses**:
- Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Reputation Registry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

## SDKs

**Python**: [erc-8004-py](https://github.com/tetratorus/erc-8004-py), [Praxis Python SDK](https://github.com/prxs-ai/praxis-py-sdk)

**JavaScript/TypeScript**: [erc-8004-js](https://github.com/tetratorus/erc-8004-js), [Praxis JS SDK](https://github.com/prxs-ai/praxis-js-sdk)

**Go**: [Praxis Go SDK](https://github.com/prxs-ai/praxis-go-sdk)

**Contracts**: [erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts)

## Relationship to x402

| ERC-8004 | x402 |
|----------|------|
| **Identity + Trust** | **Payments** |
| Who is this agent? Should I trust it? | How do I pay this agent? |
| On-chain registries | HTTP protocol extension |

Integration points:
- Registration file has `x402Support: true/false`
- Reputation feedback includes `proofOfPayment` with x402 tx data
- Only clients who paid (via x402) can leave reputation feedback

## Key Links

- **EIP Spec**: [eips.ethereum.org/EIPS/eip-8004](https://eips.ethereum.org/EIPS/eip-8004)
- **Website**: [8004.org](http://8004.org)
- **Contracts**: [github.com/erc-8004/erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts)
- **Resources**: [github.com/sudeepb02/awesome-erc8004](https://github.com/sudeepb02/awesome-erc8004)
- **Discussion**: [Ethereum Magicians](https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098)
- **Telegram**: [t.me/ERC8004](http://t.me/ERC8004)
