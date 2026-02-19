# Ultimatum Game: Agentic AI on Web3 - Product Requirements Document

**Author**: ETHDenver Team
**Date**: 2026-02-17
**Project Level**: 3
**Version**: 1.0

---

## Goals

- **Demonstrate agentic AI feasibility in web3** — Three autonomous AI agents complete a full Ultimatum Game with on-chain identity, payments, and reputation on Base
- **Showcase full-stack web3 agent integration** — Compose ERC-8004 (identity), x402 (payments), OpenClaw (communication), and Base Agent SDK (wallets) into a single working system
- **Enable human-driven agent strategy** — Humans craft system prompts (SOUL.md) that produce observably different agent behaviors in the game
- **Create an observable, explainable demo** — Every agent message displays identity, balance, and reputation; every decision includes rationale visible in Telegram

---

## Background Context

The Ultimatum Game is a foundational behavioral economics experiment with 40+ years of human data. One player (proposer) proposes how to split a fixed sum; the other (responder) accepts or rejects. If rejected, both get nothing. Human results consistently show fairness norms and altruistic punishment — deviating from the game-theoretic "rational" prediction.

The building blocks for autonomous AI agents on-chain now exist — LLM reasoning, on-chain identity (ERC-8004), HTTP-native payments (x402), agent communication frameworks (OpenClaw), and programmatic wallets (Base Agent SDK) — but they have not been composed into a single end-to-end demonstration. This project fills that gap by replicating the Ultimatum Game with AI agents on Base, proving that agents can autonomously hold identity, reason about strategy, communicate, transact, and build reputation.

---

## Functional Requirements

### Agent Setup & Identity

| ID | Requirement | Priority |
|----|-------------|----------|
| FR001 | System shall instantiate three OpenClaw agents (researcher, proposer, responder) in a shared Telegram group chat | Must |
| FR002 | Each agent shall be created with a Base Agent SDK wallet on Base Sepolia at instantiation | Must |
| FR003 | Each agent shall automatically register an ERC-8004 identity on Base via a custom OpenClaw skill at startup | Must |
| FR004 | Each agent shall ship with a distinct default SOUL.md persona (researcher = neutral orchestrator, proposer = strategic/analytical, responder = evaluative/principled) | Must |
| FR005 | Humans shall be able to modify each agent's SOUL.md to change its strategy and behavior | Must |

### Game Orchestration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR006 | Researcher agent shall introduce the Ultimatum Game, announce the endowment amount, and trigger the proposer to make an offer | Must |
| FR007 | Researcher agent shall accept game parameters (endowment size) as configuration | Must |
| FR008 | Proposer agent shall propose a specific numerical split of the endowment and explain its rationale for why the split is fair or optimal | Must |
| FR009 | Responder agent shall accept or reject the proposal and explain its rationale for the decision | Must |
| FR010 | The game shall allow any valid split including a 0 offer — the responder decides based on its SOUL.md strategy | Must |

### On-Chain Payments

| ID | Requirement | Priority |
|----|-------------|----------|
| FR011 | On acceptance, researcher agent shall send test USDC to proposer and responder wallets via x402 according to the agreed split | Must |
| FR012 | On rejection, researcher agent shall retain the full endowment (no transfers) | Must |
| FR013 | All payment transactions shall be verifiable on Base Sepolia block explorer | Must |
| FR014 | System shall use test USDC (contract: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`) on Base Sepolia | Must |

### Reputation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR015 | After each round, proposer and responder agents shall grade each other (score 0-100) via the ERC-8004 Reputation Registry | Must |
| FR016 | Reputation grades shall be posted on-chain and queryable | Must |
| FR017 | Only the two subject agents (proposer and responder) grade each other; the researcher does not participate in grading | Must |

### Identity Display

| ID | Requirement | Priority |
|----|-------------|----------|
| FR018 | Every agent message shall be prefixed with a status block showing: role, ERC-8004 agent ID, wallet address (truncated), wallet balance, and reputation score | Must |
| FR019 | Identity display shall use Telegram-compatible monospace format: `[Role | ID:#XXXX | 0xAB..12 | 10.0 USDC | Rep: 85]` | Must |
| FR020 | Reputation score shall display `-` when no ratings exist yet, and update to the numeric score after grading | Must |

### Multi-Round Support (If Time Permits)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR021 | System shall support configurable number of rounds as a parameter | Should |
| FR022 | Agents shall swap roles (proposer ↔ responder) between rounds | Should |
| FR023 | Researcher agent shall produce a summary report of outcomes after all rounds complete | Should |

---

## Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR001 | Reliability | A complete game round shall execute end-to-end without human intervention | 100% autonomous |
| NFR002 | Observability | All agent interactions, decisions, and transactions shall be visible in the Telegram group chat | Real-time visibility |
| NFR003 | Configurability | Agent behavior shall be fully customizable via SOUL.md without code changes | Prompt-only configuration |
| NFR004 | Security | Agent wallets shall only be controlled by their respective agents; no shared keys | Per-agent isolation |
| NFR005 | Testnet Safety | System shall use Base Sepolia testnet exclusively; no mainnet transactions | Zero real funds at risk |

---

## User Journeys

### Journey 1: Complete Ultimatum Game Round (Happy Path — Acceptance)

**Persona**: Observer watching the Telegram group
**Goal**: Witness a full autonomous game round with on-chain settlement

| Step | Agent Action | System Response |
|------|-------------|-----------------|
| 1 | All 3 agents start up | Each registers ERC-8004 identity, loads wallet, announces presence with status block |
| 2 | Researcher introduces the game | Posts rules, announces endowment (e.g., 10 USDC), tags @Proposer |
| 3 | Proposer makes offer | Posts split proposal (e.g., 6/4) with rationale explaining why |
| 4 | Responder evaluates | Posts acceptance with rationale explaining why |
| 5 | Researcher settles | Sends 6 USDC to Proposer and 4 USDC to Responder via x402 |
| 6 | Proposer grades Responder | Posts rating (e.g., 85/100) to ERC-8004 Reputation Registry |
| 7 | Responder grades Proposer | Posts rating (e.g., 70/100) to ERC-8004 Reputation Registry |
| 8 | Updated messages show new reputation | Subsequent messages display updated Rep scores |

**Alternative Path — Rejection**:
- At Step 4, Responder rejects with rationale → Step 5: Researcher announces rejection, retains all funds → Step 6-7: Agents still grade each other

### Journey 2: Prompt Author Changes Agent Strategy

**Persona**: Human prompt author
**Goal**: Craft a strategy that changes agent behavior

| Step | User Action | System Response |
|------|-------------|-----------------|
| 1 | Edit proposer's SOUL.md to be maximally greedy | File saved in OpenClaw workspace |
| 2 | Restart/trigger a new game | Proposer agent loads new persona |
| 3 | Observe proposer behavior | Proposer offers 9/1 split with rationale based on self-interest |
| 4 | Observe responder reaction | Responder likely rejects, citing unfairness in rationale |
| 5 | Compare outcomes | Different prompts produce observably different game results |

---

## UX/UI Vision

### UX Principles

1. **Observability first**: Every decision, transaction, and rating is visible in the chat — nothing happens "behind the scenes"
2. **Self-explanatory**: Agents explain their reasoning, making the demo comprehensible to non-technical observers
3. **Consistent identity**: The status block format is identical across all agents and all messages

### Core Interface

| Surface | Purpose | Key Elements |
|---------|---------|--------------|
| Telegram group chat | Primary observation surface | Agent messages with status blocks, rationale, and game flow |
| Base Sepolia block explorer | Transaction verification | x402 payment receipts, ERC-8004 registrations |
| SOUL.md files | Strategy configuration | Human-editable persona files per agent |

### Design Constraints

- Telegram message formatting only (monospace blocks, bold, basic markdown)
- No web UI, mobile app, or dashboard
- All interaction happens in a single Telegram group

---

## Epic List

| Epic | Title | Goal | Est. Stories |
|------|-------|------|--------------|
| 1 | Agent Foundation | Set up 3 OpenClaw agents with wallets, ERC-8004 identity, and Telegram group chat | 6 |
| 2 | Game Engine | Implement the Ultimatum Game flow — orchestration, proposal, response, and x402 settlement | 6 |
| 3 | Reputation & Display | Add reputation grading via ERC-8004 and identity display on every message | 5 |

> Detailed epic breakdown with stories available in [epics.md](./epics.md)

---

## Out of Scope

### Deferred to Future Phases

- **Multi-round games** — Configurable rounds and role swapping (Should Have, post-demo)
- **Tournament/bracket mode** — Multiple prompt authors competing across agent pairs
- **Dictator game variant** — Responder has no veto power
- **Game results analytics** — Researcher produces summary reports with statistics

### Explicitly Excluded

- **Web UI** — No frontend; humans edit SOUL.md in code, observers watch Telegram
- **Real USDC / mainnet** — Test tokens on Base Sepolia only
- **Analytics dashboard** — Results visible in Telegram and on-chain explorer
- **Cross-cultural experiment variations** — Academic feature, not needed for demo

### Platform Limitations

- **Telegram only** — No Discord, Slack, or other messaging platforms
- **Base Sepolia only** — No other chains or mainnets
- **Claude via OpenClaw only** — No multi-LLM support

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-17 | ETHDenver Team | Initial PRD |

---

## References

- [Requirements Brief](./requirements-brief.md)
- [Research: x402 Protocol](./Research/research-x402.md)
- [Research: ERC-8004](./Research/research-eip8004.md)
- [Research: OpenClaw](./Research/research-openclaw.md)
- [Ultimatum Game — Wikipedia](https://en.wikipedia.org/wiki/Ultimatum_game)
- [x402 Protocol — Coinbase](https://github.com/coinbase/x402)
- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [OpenClaw Documentation](https://docs.openclaw.ai)
- [Circle Testnet Faucet](https://faucet.circle.com/)
