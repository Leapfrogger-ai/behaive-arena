# Corrected Bounty Analysis — ETHDenver 2026

**Date**: 2026-02-19
**Status**: Revised analysis based on verified bounty data
**Context**: Original `hackathon-research.txt` contained significant accuracy issues. This is the corrected version.

---

## Issues with Original Research

| Original Claim | Correction |
|---|---|
| Hedera is a "PERFECT MATCH" ⭐⭐⭐⭐⭐ | Good match for the OpenClaw angle, but requires real Hedera integration work — not a redeployment |
| x402 works on Hedera natively | x402 on Hedera is community-supported (BlockyDevs facilitator, testnet only), not Coinbase-official |
| Multi-chain = "deploy same code 3 times" | Base→Kite AI might be a redeploy; Base→Hedera is a separate integration; Base→0G is a different architecture |
| "$20K guaranteed" | Nothing is guaranteed. $10K Base is the highest-confidence target |
| Streamlit dashboard as core component | PRD rightly excludes this — Telegram is the interface |
| GPT-4 for agent brain | Claude via OpenClaw — already correct in the PRD |
| `@openclaw/sdk` npm package | OpenClaw is a self-hosted gateway, not an npm SDK |

---

## Full ETHDenver 2026 Prize Pool: $126,000

| Sponsor | Prize Pool |
|---|---|
| Hedera | $25,000 (4 tracks) |
| 0G Labs | $25,000 (4 tracks) |
| ADI Foundation | $25,000 (3 tracks) |
| Canton Network | $15,000 (2 tracks) |
| ETHDenver (Organizer) | $12,000 (6 themed tracks) |
| Base (Coinbase) | $10,000 (1 track) |
| Kite AI | $10,000 (1 track) |
| QuickNode | $2,000 (2 tracks) |
| Blockade Labs | $2,000 (1 track) |

Teams can submit to **up to 10 sponsor bounties**.

---

## TIER 1: Strongest Fit — $20K potential

### Base: "Self-Sustaining Autonomous Agents" — $10,000

**Effort to adapt: None (this IS your project)**

The Ultimatum Game with autonomous agents on Base is a direct hit. Three agents that independently hold wallets, make economic decisions, transact via x402, and build reputation — that's self-sustaining autonomous agents by definition.

| Requirement | Our Project |
|---|---|
| Autonomous agent operation on Base | Three OpenClaw agents, no human intervention |
| Independent resource management | Agents hold wallets, receive/send USDC |
| Self-sustaining systems | Agents reason, transact, grade, repeat |

**Relevant Coinbase technologies:**
- x402 protocol — HTTP-native payment protocol
- Agentic Wallets — non-custodial wallets in TEEs
- Base Agent SDK / CDP — Coinbase Developer Platform tools
- ERC-8004 (Trustless Agents) — co-authored by Coinbase's Erik Reppel

**This should be the anchor submission.** Everything else is additive.

---

### Kite AI: "Agent-Native Payments & Identity (x402-Powered)" — $10,000

**Effort to adapt: Low-Medium — deploy same contracts to a second EVM chain**

Kite AI is EVM-compatible (Avalanche L1) and explicitly wants x402 + agent identity. Since we're already building x402 payments and ERC-8004 identity, the question is: can we deploy the same Solidity contracts to Kite AI testnet?

**Kite AI Testnet Details:**
- Chain ID: 2368
- RPC: `https://rpc-testnet.gokite.ai/`
- Block Explorer: `https://testnet.kitescan.ai/`
- Faucet: `https://faucet.gokite.ai/`
- Token: KITE
- EVM-compatible (Avalanche L1)

**What's needed:**

| Task | Difficulty |
|---|---|
| Deploy contracts to Kite AI testnet | Point Hardhat at a new RPC — trivial if contracts are chain-agnostic |
| Get test tokens from faucet | Minutes |
| Show x402 payment flow on Kite AI | Depends on whether Kite has an x402 facilitator running, or we self-host |
| Agent identity on Kite | Deploy ERC-8004 contracts to Kite testnet |

**Bounty requirements:**
- Demonstrate agent-to-agent transactions using Kite AI's payment infrastructure
- Integrated identity verification systems
- Showcase practical autonomous commerce scenarios
- Must integrate Kite AI's native capabilities

**Risk:** Kite AI's x402 facilitator maturity is unclear. If their x402 infra isn't ready, fallback to direct contract calls instead of HTTP 402 flow. Worth checking their booth or Discord.

**Kite AI also supports:** Google's A2A, Anthropic's MCP, OAuth 2.1, Agent Payment Protocol.

---

## TIER 2: Strong Fit, Real Work Required — $10K-$18K potential

### Hedera: "Killer App for the Agentic Society (OpenClaw)" — $10,000

**Effort to adapt: Medium-High — requires Hedera-specific integration, NOT just redeploying**

**What makes it viable:**
- We ARE using OpenClaw — that's the bounty's explicit requirement
- The ETHDenver bounty ($10K) does NOT mandate specific Hedera services (HTS/HCS) — it judges on "Hedera integration depth"
- x402 on Hedera IS possible via a community facilitator (BlockyDevs, testnet only)
- ERC-8004 has testnet contracts on Hedera

**What makes it hard:**
- "Hedera integration depth" as judging criteria means shallow integration won't win
- Need to add at least HCS (Consensus Service) for game attestations
- `@hashgraph/sdk` is a separate SDK from Base toolchain
- No existing Hedera OpenClaw skill — we'd build the first one (selling point, but time cost)

**Minimum viable Hedera integration:**
1. Log each game round to HCS (immutable attestation of proposals/responses/outcomes)
2. Use the Hedera x402 facilitator for at least one payment flow
3. Register agents via HCS-10 (Hedera's agent discovery protocol)

**Key Hedera primitives:**

| Service | What It Does for Agents | SDK |
|---|---|---|
| HTS (Token Service) | Create/transfer tokens without smart contracts | `@hashgraph/sdk` |
| HCS (Consensus Service) | Immutable message logging, agent communication | `@hashgraph/sdk` |
| HCS-10 (OpenConvAI) | Agent registration, discovery, P2P messaging | `@hashgraphonline/standards-sdk` |
| x402 | HTTP-native micropayments | BlockyDevs facilitator |

**IMPORTANT: Hedera Apex Hackathon (StackUp) — $8K additional, deadline March 23.**
This is a SEPARATE hackathon. Same project could be submitted with deeper Hedera integration after ETHDenver. More strict requirements (must use HTS/HCS/EVM).

**Hedera ETHDenver judging criteria:** Innovation, feasibility, execution quality, Hedera integration depth, market validation, impact on Hedera metrics (accounts/TPS), pitch quality.

---

### ETHDenver: Futurllama Track — $1,000 (x2 winners)

**Effort: Zero — just submit**

Covers "emerging tech: AI, DePIN, frontier technologies." Our project qualifies. Low prize, but free to enter alongside sponsor bounties.

---

## TIER 3: Stretch Goals — Diminishing Returns

### 0G Labs: Best Use of On-Chain Agent (iNFT) — $7,000

**Effort: High — different identity model, new chain, new SDK**

Requires representing agents as ERC-7857 iNFTs on 0G Chain. Fundamentally different identity approach from ERC-8004.

**Would need:**
- 0G testnet setup (faucet: `faucet.0g.ai`, 0.1 OG/day)
- Implement ERC-7857 iNFT contracts (not ERC-8004)
- Upload agent behavioral models to 0G Storage
- Deploy and mint agent NFTs
- Chain ID: 16601, RPC: `https://evmrpc-testnet.0g.ai`

$7K doesn't justify the architectural divergence unless parallelizable independently.

---

### 0G Labs: Best DeFAI Application — $7,000

**Effort: Medium — mostly a framing exercise**

Could frame the Ultimatum Game as a DeFAI primitive — "AI-driven fair value distribution mechanism." Bounty requires: "AI must do more than chat — it should produce structured decisions, guardrails, or automation." Our agents DO make structured economic decisions, so it's defensible but a stretch.

---

### Blockade Labs: "Solving the Homeless Agent Problem" — $2,000

**Effort: Low — framing exercise**

If agents have persistent on-chain identity (ERC-8004), wallets, and reputation, we're arguably solving the "homeless agent" problem. Worth a submission if time permits.

---

## Revised Prize Matrix

| Bounty | Prize | Fit | Effort | Recommendation |
|---|---|---|---|---|
| **Base** | $10K | Perfect | None | **MUST submit** |
| **Kite AI** | $10K | Strong | Low-Med | **Submit if contracts port cleanly** |
| **Hedera** | $10K | Good (with work) | Med-High | **Submit if HCS integration feasible today; otherwise defer to Apex (March 23)** |
| **Futurllama** | $1K | Fine | Zero | **Submit** |
| **Blockade Labs** | $2K | Tangential | Low | **Submit if time** |
| **0G DeFAI** | $7K | Stretch | Medium | **Only if parallelizable** |
| **0G iNFT** | $7K | Low | High | **Skip for ETHDenver** |

---

## Recommended Priority (Day 3)

1. **Lock down the Base submission** — highest-confidence $10K target
2. **Test Kite AI deployment** — try deploying contracts to `rpc-testnet.gokite.ai`. If they work, unlock another $10K with minimal effort
3. **Evaluate Hedera** — if bandwidth exists, add HCS attestation logging. If not, Apex hackathon (March 23) gives time
4. **Write Futurllama submission** — 10 minutes of work for a $1K shot

**Realistic target: $10K-$21K** (Base + Kite AI + Futurllama), with Hedera as upside.

---

## Key Resources

**Base:**
- x402 Docs: https://docs.cdp.coinbase.com/x402/welcome
- Base Agent SDK: https://docs.cdp.coinbase.com
- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004

**Kite AI:**
- Docs: https://docs.gokite.ai/
- Faucet: https://faucet.gokite.ai/
- Testnet RPC: https://rpc-testnet.gokite.ai/
- Explorer: https://testnet.kitescan.ai/

**Hedera:**
- OpenClaw Docs: https://docs.openclaw.ai
- Hedera SDK: https://docs.hedera.com/
- HCS-10: https://hol.org/docs/standards/hcs-10/
- x402 on Hedera: https://hedera.com/blog/hedera-and-the-x402-payment-standard/
- Apex Hackathon: https://hackathon.stackup.dev/web/events/hedera-hello-future-apex-hackathon-2026

**Submission:**
- Devfolio: https://ethdenver2026.devfolio.co/prizes
- Up to 10 sponsor bounties per team
- Deliverables: Public repo, demo URL/CLI, video <3 min, README
