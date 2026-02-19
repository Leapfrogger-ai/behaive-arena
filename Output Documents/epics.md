# Ultimatum Game: Agentic AI on Web3 - Epic Breakdown

**PRD Reference**: [PRD.md](./PRD.md)
**Date**: 2026-02-17
**Total Epics**: 3
**Total Stories**: 17

---

## Human Prerequisites

These steps **must be completed manually by a human** before development begins. They cannot be automated.

### P1: Telegram BotFather Setup
**Owner**: Team member with Telegram account
**Time**: ~10 minutes

- [ ] Message `@BotFather` on Telegram
- [ ] Run `/newbot` three times to create: `researcher_bot`, `proposer_bot`, `responder_bot`
- [ ] Save all three bot tokens securely
- [ ] Run `/setprivacy` → select each bot → **Disable** (repeat x3)
- [ ] Create a new Telegram group
- [ ] Add all three bots to the group
- [ ] **Promote all three bots to admin** (critical — bots cannot see other bots' messages without admin)
- [ ] Lock "Pin Messages" and "Change Group Info" permissions to admins only
- [ ] Note the group chat ID (negative number, e.g., `-1001234567890`)

**Output needed**: 3 bot tokens + 1 group chat ID

### P2: Coinbase Developer Platform Account
**Owner**: Team member with email
**Time**: ~5 minutes

- [ ] Sign up at [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) (free)
- [ ] Generate an API key pair (key ID + key secret)
- [ ] Save credentials securely

**Output needed**: CDP API key ID + key secret

### P3: Fund Researcher Wallet with Test USDC
**Owner**: Any team member (after wallets are created in Story 1.3)
**Time**: ~2 minutes
**Dependency**: Wallet addresses must exist first

- [ ] Go to [faucet.circle.com](https://faucet.circle.com/)
- [ ] Select **USDC** → **Base Sepolia**
- [ ] Paste the researcher agent's wallet address
- [ ] Request 20 USDC (can repeat every 2 hours if more needed)

**USDC contract on Base Sepolia**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

**Alternative (automatable)**: Use CDP SDK programmatic faucet after P2 is complete:
```python
from cdp import CdpClient
cdp = CdpClient()
await cdp.evm.request_faucet(address="0x...", network="base-sepolia", token="usdc")
```

### P4: Fund All Agent Wallets with Base Sepolia ETH (Gas)
**Owner**: Any team member (after wallets are created in Story 1.3)
**Time**: ~5 minutes
**Dependency**: Wallet addresses must exist first

Agents need ETH for gas to execute on-chain transactions:
- ERC-8004 identity registration (`register()`)
- ERC-8004 reputation grading (`giveFeedback()`)
- Any `setAgentWallet()` calls

x402 USDC transfers are gasless (ERC-3009 + Coinbase facilitator on Base), but ERC-8004 contract calls are NOT.

- [ ] Go to [Coinbase CDP faucet](https://portal.cdp.coinbase.com/products/faucet) (requires P2 account)
- [ ] Select **ETH** → **Base Sepolia**
- [ ] Fund all 3 agent wallets with testnet ETH
- [ ] Verify balances on [sepolia.basescan.org](https://sepolia.basescan.org)

**Alternative (automatable)**: Use CDP SDK:
```python
await cdp.evm.request_faucet(address="0x...", network="base-sepolia", token="eth")
```

### P5: Set Environment Variables
**Owner**: Developer setting up the project
**Time**: ~2 minutes
**Dependency**: P1 + P2 complete

```bash
# Telegram (from P1)
export RESEARCHER_BOT_TOKEN="111111:AAA-token-here"
export PROPOSER_BOT_TOKEN="222222:BBB-token-here"
export RESPONDER_BOT_TOKEN="333333:CCC-token-here"
export TELEGRAM_GROUP_ID="-1001234567890"

# Coinbase CDP (from P2)
export CDP_API_KEY_ID="your-key-id"
export CDP_API_KEY_SECRET="your-key-secret"
```

### P6: Node.js Runtime
**Owner**: Developer
**Time**: ~5 minutes (if not already installed)

OpenClaw requires Node.js. Verify with `node --version` (needs 18+).

- [ ] Install Node.js if not present (via `nvm`, Homebrew, or nodejs.org)

### Prerequisites Completion Checklist

| Step | Output | Needed By |
|------|--------|-----------|
| P1: BotFather | 3 bot tokens + group chat ID | Story 1.1 |
| P2: CDP Account | API key ID + secret | Story 1.3 |
| P3: Fund USDC | Researcher wallet funded | Story 1.3 (after wallets created) |
| P4: Fund ETH Gas | All 3 wallets have ETH | Story 1.4 (before identity registration) |
| P5: Env Vars | All variables exported | Story 1.1 |
| P6: Node.js | `node --version` ≥ 18 | Story 1.1 |

---

## Epic Overview

| Epic | Title | Stories | Status |
|------|-------|---------|--------|
| 1 | Agent Foundation | 6 | Not Started |
| 2 | Game Engine | 6 | Not Started |
| 3 | Reputation & Display | 5 | Not Started |

---

## Epic 1: Agent Foundation

**Goal**: Set up three OpenClaw agents (researcher, proposer, responder) with Base Agent SDK wallets, ERC-8004 on-chain identities, default SOUL.md personas, and a shared Telegram group chat. After this epic, all three agents are alive in Telegram with on-chain identities and funded wallets.

**Value Delivered**: Three agents online in a Telegram group, each with a wallet and on-chain identity — ready for game logic.

**Prerequisites**: None (first epic)

---

### Story 1.1: Install OpenClaw and Configure Gateway

**As a** developer,
**I want** a running OpenClaw gateway configured for three agents,
**So that** I have the infrastructure to run the multi-agent system.

**Acceptance Criteria**:
1. Given OpenClaw is installed, when I run `openclaw agents list`, then I see three agents: `researcher`, `proposer`, `responder`
2. Given the gateway is configured, when I run `openclaw gateway restart`, then all three agents initialize without errors
3. Given the configuration uses environment variables for bot tokens, when tokens are set, then each agent connects to its respective Telegram bot

**Tasks**:
- [ ] Install OpenClaw globally (`npm install -g openclaw@latest`)
- [ ] Create three agent workspaces (`openclaw agents add researcher/proposer/responder`)
- [ ] Configure `openclaw.json` with three Telegram bot accounts, bindings, and agent definitions
- [ ] Set environment variables for `RESEARCHER_BOT_TOKEN`, `PROPOSER_BOT_TOKEN`, `RESPONDER_BOT_TOKEN`
- [ ] Verify gateway starts cleanly with `openclaw doctor`

**Prerequisites**: None

---

### Story 1.2: Create Telegram Group and Connect Bots

**As a** developer,
**I want** all three agent bots connected to a shared Telegram group,
**So that** agents can see and respond to each other's messages.

**Acceptance Criteria**:
1. Given three bots are created via BotFather, when I add them to a Telegram group, then all three appear as members
2. Given all bots are promoted to admin, when one bot sends a message, then the other two bots can see it
3. Given privacy mode is disabled on all bots, when messages are sent in the group, then all bots receive them
4. Given the group is configured with `requireMention: false`, when any agent sends a message, then other agents can respond without being @mentioned

**Tasks**:
- [ ] Create three bots via BotFather (`researcher_bot`, `proposer_bot`, `responder_bot`)
- [ ] Disable privacy mode on all three bots via `/setprivacy`
- [ ] Create a Telegram group and add all three bots
- [ ] Promote all three bots to group admin (required for bot-to-bot visibility)
- [ ] Note group chat ID and add to `openclaw.json` groups config
- [ ] Test: send a message from one bot, verify others receive it

**Prerequisites**: Story 1.1

---

### Story 1.3: Create Base Agent SDK Wallets

**As an** agent,
**I want** my own wallet on Base Sepolia created at startup,
**So that** I can hold and transact test USDC.

**Acceptance Criteria**:
1. Given an agent starts up, when wallet creation runs, then the agent has a unique Base Sepolia wallet address
2. Given three agents start, when I check their wallets, then each has a distinct address (no shared wallets)
3. Given the researcher agent's wallet, when funded via the Circle faucet, then the balance reflects the deposited test USDC
4. Given a wallet is created, when the agent is restarted, then the same wallet persists (not regenerated)

**Acceptance Criteria** (additional):
5. Given all three agent wallets exist, when funded with Base Sepolia ETH, then each wallet has sufficient ETH for gas (ERC-8004 registration + reputation transactions)

**Tasks**:
- [ ] Integrate Base Agent SDK (`pip install cdp-sdk` or equivalent) into each agent's workspace
- [ ] Create wallet initialization logic that runs on agent startup
- [ ] Implement wallet persistence (store wallet credentials securely in agent workspace)
- [ ] Fund researcher wallet with test USDC via Circle faucet (`faucet.circle.com`) — see Human Prerequisite P3
- [ ] Fund all 3 agent wallets with Base Sepolia ETH for gas — see Human Prerequisite P4
- [ ] Verify each agent can query its own wallet balance (both USDC and ETH)

**Prerequisites**: Story 1.1, Human Prerequisites P2-P4

---

### Story 1.4: Build ERC-8004 Identity Registration Skill

**As an** agent,
**I want** to automatically register my on-chain identity at startup,
**So that** I have a verifiable ERC-8004 agent ID on Base.

**Acceptance Criteria**:
1. Given an agent starts for the first time, when the identity skill runs, then it registers an ERC-8004 NFT identity on Base Sepolia
2. Given registration succeeds, when I query the Identity Registry contract (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`), then the agent's `agentId` exists
3. Given the agent's wallet is linked, when I call `getAgentWallet(agentId)`, then it returns the agent's Base Sepolia wallet address
4. Given an agent has already registered, when it restarts, then it loads its existing `agentId` instead of re-registering

**Acceptance Criteria** (additional):
5. Given the agent's wallet has Base Sepolia ETH, when registration runs, then the gas fee is paid from the agent's own wallet

**Tasks**:
- [ ] Create a custom OpenClaw skill (`skills/erc8004-identity/SKILL.md`) for identity registration
- [ ] Implement ERC-8004 Identity Registry contract interaction (register, setAgentWallet)
- [ ] Use the `erc-8004-py` SDK or direct contract calls via web3.py
- [ ] Verify agent wallet has sufficient ETH for gas before attempting registration (abort with clear error if not)
- [ ] Store `agentId` persistently in the agent's workspace (e.g., `identity.json`)
- [ ] Add startup check: if `agentId` exists, skip registration
- [ ] Test: verify registration on Base Sepolia block explorer

**Prerequisites**: Story 1.3 (wallets created + funded with ETH per Human Prerequisite P4)

---

### Story 1.5: Write Default SOUL.md Personas

**As a** developer,
**I want** each agent to ship with a distinct default persona,
**So that** the game works out-of-the-box without manual prompt editing.

**Acceptance Criteria**:
1. Given the researcher agent loads its SOUL.md, when it joins the group, then it behaves as a neutral, methodical orchestrator
2. Given the proposer agent loads its SOUL.md, when asked to propose, then it weighs self-interest against rejection risk and offers a slightly self-favorable split (~55-60/40-45)
3. Given the responder agent loads its SOUL.md, when evaluating an offer, then it applies a fairness threshold (~30-35%) and rejects offers below it
4. Given all three SOUL.md files exist, when the game runs, then agents produce distinct, role-appropriate behavior

**Tasks**:
- [ ] Write `SOUL.md` for researcher: neutral orchestrator, enforces rules, announces outcomes factually
- [ ] Write `SOUL.md` for proposer: strategic/analytical, explains rationale for splits, default slight self-bias
- [ ] Write `SOUL.md` for responder: evaluative/principled, explains rationale for accept/reject, fairness threshold
- [ ] Write `AGENTS.md` for each agent with operating instructions (game rules, message format, interaction flow)
- [ ] Test: run a game and verify each agent stays in character

**Prerequisites**: Story 1.1

---

### Story 1.6: End-to-End Foundation Verification

**As a** developer,
**I want** to verify all three agents are online with wallets, identities, and personas,
**So that** I'm confident the foundation is ready for game logic.

**Acceptance Criteria**:
1. Given all three agents are running, when I check the Telegram group, then all three are present and responsive
2. Given each agent has started, when I query their state, then each has: a wallet address, an ERC-8004 agent ID, and a loaded SOUL.md
3. Given the researcher wallet is funded, when I check balance, then it holds sufficient test USDC for the game endowment
4. Given I send a test message in the group, when agents see it, then at least one agent responds appropriately

**Tasks**:
- [ ] Run all three agents simultaneously via OpenClaw gateway
- [ ] Verify each agent's wallet address on Base Sepolia
- [ ] Verify each agent's ERC-8004 registration on block explorer
- [ ] Verify each agent responds to messages in the Telegram group
- [ ] Document the startup sequence and any manual steps required

**Prerequisites**: Stories 1.1–1.5

---

## Epic 2: Game Engine

**Goal**: Implement the full Ultimatum Game flow — researcher orchestration, proposer offer with rationale, responder decision with rationale, and x402 payment settlement. After this epic, a complete one-shot game runs autonomously in Telegram with on-chain payment settlement.

**Value Delivered**: A full Ultimatum Game round executes end-to-end without human intervention, with payments settled on Base Sepolia via x402.

**Prerequisites**: Epic 1 complete

---

### Story 2.1: Researcher Game Introduction and Configuration

**As a** researcher agent,
**I want** to introduce the Ultimatum Game and announce the endowment,
**So that** the proposer and responder understand the rules and stakes.

**Acceptance Criteria**:
1. Given the game is triggered, when the researcher posts the introduction, then it clearly states: the game name, the rules, the endowment amount, and who plays which role
2. Given the endowment is configurable, when set to 10 USDC, then the researcher announces "The endowment is 10 USDC"
3. Given the introduction is posted, when the researcher finishes, then it tags @Proposer to make an offer
4. Given the endowment amount, when the researcher checks its wallet, then it confirms it holds at least that amount

**Tasks**:
- [ ] Add game configuration parameters to researcher's `AGENTS.md` (endowment amount)
- [ ] Implement introduction message template in researcher's SOUL.md/AGENTS.md
- [ ] Add wallet balance check before game start (abort if insufficient funds)
- [ ] Implement mention-based handoff to proposer agent
- [ ] Test: trigger game and verify introduction message format

**Prerequisites**: Epic 1 complete

---

### Story 2.2: Proposer Makes Offer with Rationale

**As a** proposer agent,
**I want** to propose a split and explain my reasoning,
**So that** the responder (and observers) understand my strategy.

**Acceptance Criteria**:
1. Given the researcher tags the proposer, when the proposer responds, then it proposes a specific numerical split (e.g., "I take 6, you get 4")
2. Given the proposer makes an offer, when the message is posted, then it includes a rationale paragraph explaining why the split is fair or optimal
3. Given the proposer's SOUL.md defines a greedy strategy, when it proposes, then the split reflects that strategy (e.g., 8/2 or 9/1)
4. Given the proposer's SOUL.md defines a fair strategy, when it proposes, then the split reflects that strategy (e.g., 5/5 or 6/4)
5. Given the endowment is 10 USDC, when the proposer proposes, then the two amounts sum exactly to 10

**Tasks**:
- [ ] Add proposal instructions to proposer's SOUL.md (must include specific numbers + rationale)
- [ ] Add structured output format in AGENTS.md (split amounts must be parseable by researcher)
- [ ] Implement mention-based handoff: proposer tags @Responder after proposal
- [ ] Test with default SOUL.md: verify proposal is in the 55-60/40-45 range with rationale
- [ ] Test with modified greedy SOUL.md: verify proposal shifts accordingly

**Prerequisites**: Story 2.1

---

### Story 2.3: Responder Accepts or Rejects with Rationale

**As a** responder agent,
**I want** to evaluate the proposal and explain my decision,
**So that** observers understand why I accepted or rejected.

**Acceptance Criteria**:
1. Given the proposer tags the responder with an offer, when the responder evaluates, then it posts either "I accept" or "I reject"
2. Given the responder decides, when the message is posted, then it includes a rationale paragraph explaining why
3. Given a fair offer (e.g., 5/5), when the default responder evaluates, then it accepts
4. Given an unfair offer (e.g., 9/1), when the default responder evaluates, then it rejects citing unfairness
5. Given a 0 offer, when the responder evaluates, then it makes a decision based on its SOUL.md (not a system error)
6. Given the responder decides, when the message is posted, then it tags @Researcher to signal the decision

**Tasks**:
- [ ] Add evaluation instructions to responder's SOUL.md (must include accept/reject + rationale)
- [ ] Add structured output format in AGENTS.md (decision must be parseable by researcher)
- [ ] Implement mention-based handoff: responder tags @Researcher after decision
- [ ] Test with fair offer (5/5): verify acceptance with rationale
- [ ] Test with unfair offer (9/1): verify rejection with rationale
- [ ] Test with 0 offer: verify graceful handling

**Prerequisites**: Story 2.2

---

### Story 2.4: x402 Payment Settlement on Acceptance

**As a** researcher agent,
**I want** to send test USDC to the proposer and responder via x402 on acceptance,
**So that** the game outcome is settled on-chain.

**Acceptance Criteria**:
1. Given the responder accepts, when the researcher processes settlement, then it sends the proposer's share to the proposer's wallet and the responder's share to the responder's wallet
2. Given settlement is executed, when I check Base Sepolia block explorer, then both transactions are confirmed
3. Given 6/4 split on 10 USDC endowment, when settlement completes, then proposer wallet shows +6 USDC and responder wallet shows +4 USDC
4. Given settlement completes, when the researcher posts confirmation, then the message includes both transaction hashes

**Tasks**:
- [ ] Integrate x402 Python SDK (`pip install x402[evm]`) or implement direct x402 HTTP payment flow
- [ ] Implement settlement logic: parse the accepted split, send USDC to both wallets
- [ ] Add transaction confirmation step (wait for on-chain confirmation)
- [ ] Post settlement confirmation message with transaction links
- [ ] Test: execute a settlement and verify on Base Sepolia explorer

**Prerequisites**: Story 2.3

---

### Story 2.5: Handle Rejection Flow

**As a** researcher agent,
**I want** to handle rejection by retaining all funds,
**So that** the game follows Ultimatum Game rules when the responder rejects.

**Acceptance Criteria**:
1. Given the responder rejects, when the researcher processes the outcome, then no USDC is transferred to either agent
2. Given rejection, when the researcher posts the outcome, then it announces "Offer rejected. No funds distributed. Both players receive nothing."
3. Given rejection, when I check the researcher's wallet, then the balance is unchanged
4. Given rejection, when the game flow continues, then it proceeds to the reputation grading phase

**Tasks**:
- [ ] Add rejection detection logic (parse responder's structured output)
- [ ] Implement rejection announcement message
- [ ] Ensure no x402 calls are made on rejection
- [ ] Implement handoff to reputation phase regardless of accept/reject
- [ ] Test: trigger rejection and verify no funds move

**Prerequisites**: Story 2.3

---

### Story 2.6: End-to-End Game Flow Verification

**As a** developer,
**I want** to verify a complete game round runs autonomously,
**So that** I'm confident the game engine works for demo day.

**Acceptance Criteria**:
1. Given all agents are running, when the game is triggered, then the full sequence completes: introduction → proposal → response → settlement (or rejection) without human intervention
2. Given an acceptance scenario, when the game completes, then USDC is in the correct wallets on-chain
3. Given a rejection scenario, when the game completes, then no funds moved
4. Given both scenarios, when I review the Telegram chat, then every message is clear, well-formatted, and includes rationale where required

**Tasks**:
- [ ] Run full acceptance scenario end-to-end
- [ ] Run full rejection scenario end-to-end
- [ ] Verify timing and message ordering are correct
- [ ] Fix any edge cases or formatting issues discovered
- [ ] Document the game trigger mechanism (how to start a new game)

**Prerequisites**: Stories 2.1–2.5

---

## Epic 3: Reputation & Display

**Goal**: Add ERC-8004 reputation grading after each round and identity status blocks on every agent message. After this epic, agents grade each other on-chain and every message displays wallet, identity, and reputation — completing the full demo.

**Value Delivered**: The demo is complete — full game with visible on-chain identity, payments, and reputation in every message.

**Prerequisites**: Epic 2 complete

---

### Story 3.1: Implement Reputation Grading Skill

**As a** subject agent (proposer or responder),
**I want** to grade the other agent after the round,
**So that** our interaction contributes to on-chain reputation.

**Acceptance Criteria**:
1. Given the game round completes (accept or reject), when the proposer grades, then it posts a score (0-100) for the responder with a brief justification
2. Given the proposer grades, when the responder grades, then it posts a score (0-100) for the proposer with a brief justification
3. Given a grade is posted, when I query the ERC-8004 Reputation Registry (`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`), then the feedback is recorded on-chain
4. Given the researcher agent, when grading occurs, then it does not participate — only observes and announces

**Acceptance Criteria** (additional):
5. Given the grading agent's wallet has Base Sepolia ETH, when `giveFeedback` is called, then gas is paid from the agent's own wallet

**Tasks**:
- [ ] Create a custom OpenClaw skill (`skills/erc8004-reputation/SKILL.md`) for reputation grading
- [ ] Implement ERC-8004 Reputation Registry interaction (giveFeedback, getSummary)
- [ ] Verify agent wallet has sufficient ETH for gas before attempting grading (warn in chat if insufficient)
- [ ] Add grading instructions to proposer and responder SOUL.md/AGENTS.md
- [ ] Implement grading flow: proposer grades first, then responder
- [ ] Test: verify feedback appears on-chain via contract query or block explorer

**Prerequisites**: Epic 2 complete (agent wallets must have ETH — see Human Prerequisite P4)

---

### Story 3.2: Query and Display Reputation Scores

**As an** agent,
**I want** to query my current reputation score,
**So that** I can display it in my messages.

**Acceptance Criteria**:
1. Given an agent has received ratings, when it queries its reputation, then it gets an aggregated score (average of all ratings received)
2. Given an agent has no ratings yet, when it queries its reputation, then it returns `-` (no data)
3. Given reputation is queried, when the result is returned, then it is a number between 0 and 100

**Tasks**:
- [ ] Implement reputation query function using ERC-8004 `getSummary` contract call
- [ ] Handle the "no ratings yet" case (return `-`)
- [ ] Cache reputation locally to avoid excessive on-chain calls
- [ ] Test: query reputation after grading and verify correct score

**Prerequisites**: Story 3.1

---

### Story 3.3: Build Identity Status Block for Messages

**As an** observer watching the Telegram group,
**I want** every agent message to show identity, wallet, balance, and reputation,
**So that** I can track each agent's state throughout the game.

**Acceptance Criteria**:
1. Given any agent sends a message, when it appears in Telegram, then it is prefixed with: `[Role | ID:#XXXX | 0xAB..12 | 10.0 USDC | Rep: 85]`
2. Given the agent has no reputation yet, when the status block renders, then it shows `Rep: -`
3. Given the agent's balance changes (after settlement), when the next message is sent, then the balance reflects the updated amount
4. Given the status block format, when viewed on Telegram mobile and desktop, then it renders correctly in monospace

**Tasks**:
- [ ] Create a message formatting utility that prepends the status block to all outgoing messages
- [ ] Integrate wallet balance query (Base Agent SDK)
- [ ] Integrate reputation score query (Story 3.2)
- [ ] Integrate ERC-8004 agent ID lookup
- [ ] Truncate wallet address to `0xAB..12` format (first 4 + last 4 chars)
- [ ] Add status block injection to each agent's AGENTS.md instructions
- [ ] Test: verify format on both Telegram mobile and desktop

**Prerequisites**: Story 3.2

---

### Story 3.4: Integrate Status Block into Game Flow

**As an** observer,
**I want** the status block to appear on every game message,
**So that** the entire game is annotated with live agent state.

**Acceptance Criteria**:
1. Given the researcher introduces the game, when the message appears, then it includes the researcher's status block
2. Given the proposer makes an offer with rationale, when the message appears, then it includes the proposer's status block
3. Given the responder accepts/rejects with rationale, when the message appears, then it includes the responder's status block
4. Given settlement completes, when the researcher confirms, then its status block shows the updated (reduced) balance
5. Given grading completes, when agents send subsequent messages, then their status blocks show the new reputation scores

**Tasks**:
- [ ] Verify status block renders on all game-phase messages (introduction, proposal, response, settlement, grading)
- [ ] Verify balance updates correctly after x402 settlement
- [ ] Verify reputation updates correctly after grading
- [ ] Fix any formatting or timing issues
- [ ] Run full game and screenshot the complete Telegram thread for demo

**Prerequisites**: Story 3.3

---

### Story 3.5: Full Demo Dry Run

**As a** hackathon team,
**I want** to run a complete demo from start to finish,
**So that** we're confident everything works for presentation.

**Acceptance Criteria**:
1. Given a fresh start, when the game is triggered, then the full flow completes: startup → identity registration → game introduction → proposal with rationale → response with rationale → settlement → grading → updated status blocks
2. Given the demo, when reviewed on-chain, then we can show: ERC-8004 agent registrations, x402 USDC transfers, reputation feedback — all on Base Sepolia explorer
3. Given the demo, when observed in Telegram, then every message has a consistent status block and the flow is self-explanatory
4. Given a second run with modified SOUL.md, when the game replays, then agent behavior is observably different

**Tasks**:
- [ ] Run full acceptance scenario dry run
- [ ] Run full rejection scenario dry run
- [ ] Run with modified SOUL.md (greedy proposer) and verify different behavior
- [ ] Verify all on-chain artifacts on Base Sepolia explorer
- [ ] Capture screenshots/recording for presentation
- [ ] Document any known issues or limitations

**Prerequisites**: Stories 3.1–3.4

---

## Dependency Map

```
Epic 1: Agent Foundation
    └── 1.1 (Gateway) → 1.2 (Telegram) ──────────────────┐
                      → 1.3 (Wallets) → 1.4 (ERC-8004) ──┤
                      → 1.5 (SOUL.md) ────────────────────┤
                                                           └── 1.6 (Verification)
                                                                     ↓
Epic 2: Game Engine
    └── 2.1 (Intro) → 2.2 (Propose) → 2.3 (Respond) → 2.4 (Settlement)
                                                      → 2.5 (Rejection)
                                                           └── 2.6 (Verification)
                                                                     ↓
Epic 3: Reputation & Display
    └── 3.1 (Grading) → 3.2 (Query Rep) → 3.3 (Status Block) → 3.4 (Integration)
                                                                       └── 3.5 (Dry Run)
```

---

## Requirements Traceability

| Story | Implements FRs | Implements NFRs |
|-------|----------------|-----------------|
| 1.1 | FR001 | - |
| 1.2 | FR001 | - |
| 1.3 | FR002 | NFR004, NFR005 |
| 1.4 | FR003 | - |
| 1.5 | FR004, FR005 | NFR003 |
| 1.6 | - | NFR001 |
| 2.1 | FR006, FR007 | NFR002 |
| 2.2 | FR008, FR010 | NFR002 |
| 2.3 | FR009, FR010 | NFR002 |
| 2.4 | FR011, FR013, FR014 | NFR001 |
| 2.5 | FR012 | NFR001 |
| 2.6 | - | NFR001 |
| 3.1 | FR015, FR016, FR017 | - |
| 3.2 | FR016, FR020 | - |
| 3.3 | FR018, FR019, FR020 | NFR002 |
| 3.4 | FR018 | NFR002 |
| 3.5 | - | NFR001, NFR002 |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-17 | ETHDenver Team | Initial breakdown |
| 1.1 | 2026-02-17 | ETHDenver Team | Added Human Prerequisites section, added gas (ETH) funding to Stories 1.3, 1.4, and 3.1 |
