# Product Requirements Brief: Ultimatum Game — Agentic AI on Web3

**Version**: 1.1
**Date**: 2026-02-17
**Author**: ETHDenver Team
**Status**: Draft

---

## Executive Summary

A multi-agent simulation of the classic Ultimatum Game from behavioral economics, built to demonstrate the feasibility of agentic AI in web3. Three AI agents — a researcher, a proposer, and a responder — interact autonomously in a Telegram group chat via OpenClaw, hold on-chain identities (ERC-8004) on Base, make strategic decisions driven by human-authored system prompts, settle payments in test USDC via the x402 protocol, and grade each other's behavior into an on-chain reputation system. The project is a hackathon submission for ETHDenver 2026.

---

## 1. Problem Statement

### 1.1 Current State

Agentic AI in web3 is an emerging concept, but there is a lack of compelling, end-to-end demonstrations showing that AI agents can autonomously participate in structured economic interactions — holding identity, reasoning about strategy, communicating with peers, and transacting on-chain — the way humans do.

### 1.2 Problem Definition

**Who**: The web3/AI community, hackathon judges, and developers exploring agentic architectures
**What**: No clear, accessible proof-of-concept showing AI agents operating autonomously in a well-understood economic game using real web3 infrastructure (identity, payments, reputation)
**Impact**: Slows adoption and understanding of agentic AI in web3; limits developer imagination for what's possible
**Evidence**: The Ultimatum Game has decades of documented human results, making it an ideal benchmark — yet no one has replicated it with on-chain AI agents

### 1.3 Root Cause Analysis

The building blocks exist (LLMs, on-chain identity, payment protocols, agent frameworks) but haven't been composed into a single working demonstration. The gap is integration, not capability.

---

## 2. Target Users

### 2.1 Primary: Hackathon Judges

| Attribute | Description |
|-----------|-------------|
| **Profile** | ETHDenver judges evaluating technical innovation and use of sponsor tech |
| **Pain Severity** | N/A (hackathon context) |
| **What They Care About** | Working demo, creative use of Coinbase/Base ecosystem, technical depth |

### 2.2 Secondary: Web3 Developers

| Attribute | Description |
|-----------|-------------|
| **Profile** | Developers exploring agentic AI patterns on-chain |
| **What They Care About** | Practical integration patterns for ERC-8004, x402, OpenClaw, Base Agent SDK |

### 2.3 Tertiary: Prompt Authors (Interactive Element)

| Attribute | Description |
|-----------|-------------|
| **Profile** | Humans who write the SOUL.md system prompts for the subject agents |
| **What They Care About** | Crafting strategies (greedy, fair, punishing) and seeing how they perform |

---

## 3. Proposed Solution

### 3.1 Solution Vision

Three AI agents play the Ultimatum Game in a Telegram group chat. A researcher agent introduces the experiment, sets the endowment, and orchestrates the game. A proposer agent proposes how to split the endowment. A responder agent accepts or rejects the proposal. On acceptance, the researcher settles payment on-chain via x402. After each round, agents grade each other and post reputation scores to the ERC-8004 Reputation Registry. Every agent message displays its wallet balance, agent ID, and reputation score.

### 3.2 Value Proposition

**For** web3 developers and the AI community
**Who** want to understand how autonomous agents can operate on-chain
**Our project** Ultimatum Game Agents
**Is a** multi-agent behavioral economics simulation on Base
**That** demonstrates end-to-end agentic AI with on-chain identity, payments, and reputation
**Unlike** conceptual whitepapers or single-agent demos
**We** show three agents autonomously interacting, transacting, and building reputation in a well-understood experimental framework

### 3.3 Key Differentiators

1. **Full-stack web3 agent demo** — identity (ERC-8004) + payments (x402) + reputation in one system
2. **Human-in-the-loop via prompts** — people craft agent strategies through SOUL.md, creating a competitive/experimental element
3. **Observable on Telegram** — the entire game plays out in a group chat anyone can watch
4. **Grounded in real science** — the Ultimatum Game has 40+ years of human data to compare against

---

## 4. Success Metrics

For a hackathon demo, success is binary:

| Goal | Success Criteria |
|------|-----------------|
| **Autonomous game execution** | Three agents complete a full Ultimatum Game round without human intervention |
| **On-chain identity** | Each agent has a registered ERC-8004 identity on Base at instantiation |
| **Wallet integration** | Each agent has a Base Agent SDK wallet and displays balance in every message |
| **On-chain settlement** | Researcher sends test USDC to agents via x402 on acceptance; retains on rejection |
| **Reputation scoring** | After each round, agents grade each other and scores are posted to ERC-8004 Reputation Registry |
| **Identity display** | Every agent message shows: wallet address, balance, ERC-8004 agent ID, reputation score |
| **Prompt-driven behavior** | Different SOUL.md prompts produce observably different strategies |

---

## 5. MVP Scope

### 5.1 Must Have (Demo Day)

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| **3 OpenClaw agents on Telegram** | Researcher, Proposer, Responder in a shared group chat | All 3 bots visible and interacting in one Telegram group |
| **Default SOUL.md per role** | Distinct default persona for each agent (researcher = methodical/neutral orchestrator, proposer = strategic/analytical, responder = evaluative/principled) | Each agent behaves according to its role without manual prompt editing |
| **ERC-8004 identity skill** | On instantiation, each agent automatically registers on Base via an OpenClaw skill, getting an NFT-based agent ID | Each agent has a unique on-chain agent ID visible in its messages |
| **Base Agent SDK wallet** | Each agent instantiated with a wallet via the SDK | Each agent has a funded wallet address on Base testnet |
| **Researcher orchestration** | Researcher introduces the game, sets endowment, triggers proposer, settles payment, handles rejection | Full game loop runs autonomously |
| **Proposer makes offer with rationale** | Proposes a split of the endowment based on its SOUL.md strategy and explains why they believe it's a fair/optimal split | Outputs a specific numerical split proposal accompanied by a reasoned justification |
| **Responder accepts/rejects with rationale** | Evaluates the offer and decides based on its SOUL.md strategy, explaining the reasoning behind acceptance or rejection | Outputs accept or reject accompanied by a reasoned justification |
| **x402 payment settlement** | On accept: researcher sends test USDC to both agents per the agreed split. On reject: funds return to researcher | On-chain transactions verifiable on Base testnet explorer |
| **Reputation grading** | After each round, agents grade each other via ERC-8004 Reputation Registry | Grades posted on-chain, queryable, and displayed in subsequent messages |
| **Identity display on every message** | Each message prefixed with: agent ID, wallet address, wallet balance, reputation score | Consistent display format across all agent messages |
| **Test tokens** | Use Base Sepolia testnet with test USDC | No real funds at risk |
| **Human-configurable prompts** | SOUL.md files define each agent's strategy; editable in code | Changing SOUL.md changes agent behavior on next game |

### 5.2 Should Have (If Time Permits)

| Feature | Rationale for Deferral |
|---------|------------------------|
| Multi-round support (configurable N rounds) | Core game works with one round; rounds are a parameter to add later |
| Role swapping between rounds (proposer ↔ responder) | Adds experimental depth but not needed for demo |
| Game results summary (researcher reports aggregate outcomes) | Nice for presentation but not core functionality |

### 5.3 Won't Have (Explicit Exclusions)

| Feature | Rationale |
|---------|-----------|
| Web UI for entering system prompts | Humans edit SOUL.md in code; no UI needed for hackathon |
| Tournament/bracket mode | Out of scope; this is a single experiment, not a competition platform |
| Dictator game variant | Future variant; one game type for MVP |
| Cross-cultural experiment variations | Academic feature; not needed for demo |
| Analytics dashboard | Results are visible in Telegram and on-chain |
| Real USDC / mainnet deployment | Test tokens on Sepolia are sufficient and risk-free |

### 5.4 MVP Success Criteria

The MVP is successful when:
- [ ] All 3 agents register ERC-8004 identities on Base automatically at startup
- [ ] A complete Ultimatum Game round plays out in Telegram without human intervention
- [ ] Payment settles on-chain via x402 (visible on block explorer)
- [ ] Agents display ID, wallet, balance, and reputation in every message
- [ ] Agents grade each other and reputation is posted on-chain after the round
- [ ] Changing a SOUL.md prompt produces different agent behavior

---

## 6. Constraints

| Constraint Type | Description | Impact | Mitigation |
|-----------------|-------------|--------|------------|
| Timeline | ETHDenver hackathon deadline | Limited build time | Ruthless MVP scope, no UI, test tokens only |
| Telegram platform | Bots can't see other bots' messages by default | Agents won't interact | Make all 3 bots group admins |
| OpenClaw message queue | Single "main lane" with concurrency cap of 4 | 1-2 min delays between agent responses | Acceptable for demo; use mention-based handoffs |
| x402 Python SDK | v2.1.0; may hit edge cases | Integration risk | Fall back to TypeScript SDK or direct HTTP calls |
| Test token availability | Need test USDC on Base Sepolia | Agents need funded wallets | Use Base Sepolia faucet |

---

## 7. Assumptions & Risks

### 7.1 Key Assumptions

| Assumption | Confidence | Validation Method | Risk if Wrong |
|------------|------------|-------------------|---------------|
| OpenClaw supports 3 bot tokens in one gateway | High | Documented in multi-agent docs | Must run 3 separate instances |
| Base Agent SDK creates wallets programmatically | High | Core SDK feature | Must create wallets manually |
| x402 Python SDK supports Base Sepolia settlement | High | v2.1.0 with `[evm]` extra | Use TypeScript SDK or raw HTTP |
| ERC-8004 contracts are deployed on Base | High | Deployed on 16+ networks incl. Base | Deploy contracts ourselves |
| LLM agents can reason about fairness/strategy via prompts | Medium | Depends on prompt engineering | Agents may behave erratically; tune prompts |
| OpenClaw `agentToAgent` + group chat works reliably | Medium | Known issues (#5813, #16055) | Fall back to mention-based handoffs only |

### 7.2 Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Infinite response loops in Telegram group | Medium | High | SOUL.md rules, mention-based handoffs, REPLY_SKIP |
| x402 settlement fails on testnet | Low | High | Pre-test settlement independently; have fallback demo flow |
| ERC-8004 registration fails | Low | Medium | Pre-register agents manually if automated skill fails |
| Context window exhaustion in long games | Medium | Medium | Keep to 1 round for demo; use `/compact` |
| Agent produces nonsensical offers (e.g., negative amounts) | Low | Low | Validate offer format in researcher agent's orchestration logic |

---

## 8. Resolved Questions

| Question | Resolution |
|----------|------------|
| **Which Base Sepolia faucet for test USDC?** | Use the **Circle Testnet Faucet** at [faucet.circle.com](https://faucet.circle.com/) — 20 USDC per request, no signup, every 2 hours. USDC contract on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. For automated setup, use the **CDP SDK programmatic faucet** (`pip install cdp-sdk`). |
| **ERC-8004 registration skill?** | We write a custom OpenClaw skill. No existing skill available. |
| **Identity display format?** | Telegram-optimized monospace block: `[Role | ID:#XXXX | 0xAB..12 | 10.0 USDC | Rep: 85]` |
| **Should the researcher be graded?** | No. Only the two subject agents (proposer and responder) grade each other. |
| **How to handle proposer offering 0?** | Allow it. The responder decides whether to accept or reject a 0 offer based on its SOUL.md strategy. This is a valid game-theoretic move. |

---

## 9. Future Vision (Post-MVP)

### 9.1 Phase 2 Features
- **Multi-round games** with configurable rounds and role swapping
- **Tournament mode** — multiple prompt authors compete; agents paired in brackets
- **Dictator game variant** — responder has no veto power
- **Game results analytics** — researcher agent produces summary reports with charts

### 9.2 Long-Term Vision
A platform for running any behavioral economics experiment with AI agents on-chain — Prisoner's Dilemma, Public Goods Game, Trust Game — creating an "agent behavioral lab" where prompt engineers compete and agent reputations accumulate over time.

### 9.3 Expansion Opportunities
- Other game types (Prisoner's Dilemma, Auction games, Coordination games)
- Real USDC on mainnet for high-stakes games
- Public leaderboard of prompt strategies ranked by agent reputation
- Academic partnerships for AI vs. human behavioral comparison studies

---

## Appendix

### A. Technical Stack

| Component | Technology | Role |
|-----------|-----------|------|
| Agent framework | OpenClaw | Telegram bots, multi-agent orchestration, workspace/persona management |
| Agent identity | ERC-8004 | On-chain NFT-based agent identity + reputation registry on Base |
| Agent payments | x402 protocol | HTTP-native USDC settlement between agents on Base |
| Agent wallets | Base Agent SDK | Programmatic wallet creation for each agent |
| Communication | Telegram group chat | Observable agent-to-agent interaction |
| Chain/Network | Base Sepolia (testnet) | On-chain transactions with test tokens |
| LLM | Claude (via OpenClaw) | Agent reasoning and decision-making |

### B. Game Flow

```
┌─────────────────────────────────────────────────────────┐
│                    TELEGRAM GROUP CHAT                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. INSTANTIATION                                        │
│     Each agent:                                          │
│     → Created via OpenClaw with Base Agent SDK wallet    │
│     → Registers ERC-8004 identity on Base (via skill)    │
│     → Loads default SOUL.md persona                      │
│                                                          │
│  2. GAME START                                           │
│     [Researcher | ID:#1001 | 0xAB..12 | 100 USDC | Rep: -]
│     "Welcome to the Ultimatum Game. The endowment is     │
│      10 USDC. @Proposer, make your offer."               │
│                                                          │
│  3. PROPOSAL (with rationale)                            │
│     [Proposer | ID:#1002 | 0xCD..34 | 0 USDC | Rep: -]  │
│     "I propose a 6/4 split. I take 6 USDC, @Responder   │
│      gets 4 USDC.                                        │
│                                                          │
│      Rationale: A 60/40 split gives me a slight edge     │
│      while still offering enough to avoid rejection.     │
│      Research shows responders typically accept offers    │
│      above 30%, so 40% should be safe."                  │
│                                                          │
│  4. RESPONSE (with rationale)                            │
│     [Responder | ID:#1003 | 0xEF..56 | 0 USDC | Rep: -] │
│     "I accept the offer.                                 │
│                                                          │
│      Rationale: 4 USDC is 40% of the endowment — not    │
│      perfectly equal, but refusing would leave me with   │
│      nothing. The proposer's reasoning seems fair        │
│      enough to cooperate."                               │
│                                                          │
│  5. SETTLEMENT (via x402)                                │
│     [Researcher | ID:#1001 | 0xAB..12 | 90 USDC | Rep: -]
│     "Offer accepted. Sending 6 USDC to @Proposer and     │
│      4 USDC to @Responder."                              │
│                                                          │
│  6. REPUTATION GRADING (via ERC-8004)                    │
│     [Proposer | ID:#1002 | 0xCD..34 | 6 USDC | Rep: -]  │
│     "I rate @Responder 85/100 — reasonable partner."     │
│                                                          │
│     [Responder | ID:#1003 | 0xEF..56 | 4 USDC | Rep: -] │
│     "I rate @Proposer 70/100 — offer was slightly        │
│      unequal but acceptable."                            │
│                                                          │
│  7. UPDATED DISPLAY (next interaction)                   │
│     [Proposer | ID:#1002 | 0xCD..34 | 6 USDC | Rep: 70] │
│     [Responder | ID:#1003 | 0xEF..56 | 4 USDC | Rep: 85]│
│                                                          │
│  REJECTION FLOW (alternate):                             │
│     Responder rejects → Researcher retains all funds     │
│     → Agents still grade each other                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### C. Default Agent Personas (SOUL.md)

**Researcher (default):**
Methodical, neutral orchestrator. Introduces the game clearly, enforces rules, settles payments precisely, and reports outcomes factually. Does not take sides.

**Proposer (default):**
Strategic and analytical. Weighs self-interest against the risk of rejection. Considers the responder's likely fairness threshold. Default tendency: slightly favorable to self but not extreme (e.g., 55-60/40-45 splits).

**Responder (default):**
Evaluative and principled. Has a fairness threshold — will reject offers perceived as too unequal, even at personal cost. Default tendency: accepts offers at or above 30-35% of the endowment, rejects below.

### D. Research Documents

- [research-x402.md](Research/research-x402.md) — x402 protocol (Coinbase HTTP 402 payments)
- [research-eip8004.md](Research/research-eip8004.md) — ERC-8004 Trustless Agents (identity + reputation)
- [research-openclaw.md](Research/research-openclaw.md) — OpenClaw agent gateway (Telegram multi-agent setup)

### E. References

- [Ultimatum Game — Wikipedia](https://en.wikipedia.org/wiki/Ultimatum_game)
- [x402 Protocol — Coinbase](https://github.com/coinbase/x402)
- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [OpenClaw Documentation](https://docs.openclaw.ai)
- [Base Agent SDK](https://docs.cdp.coinbase.com)

---

**Document History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-17 | ETHDenver Team | Initial draft from requirements elicitation |
| 1.1 | 2026-02-17 | ETHDenver Team | Added rationale requirement for proposer/responder, resolved all open questions, added faucet details |
