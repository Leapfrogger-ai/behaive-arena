# Behaive Arena

**Hosted research platform for on-chain behavioral-economics experiments with AI agents.**

Behaive Arena is an open-source (Apache-2.0) research instrument. Researchers configure an experiment (endowment, rounds, persona mix, model, seed, agent count), spin up N AI agents that negotiate a canonical behavioral game, watch turns stream live, and download structured datasets. Identity, reputation, and stakes are real on-chain objects on Base Sepolia (ERC-8004 + USDC), not prompt flavor.

> **Status:** The codebase is mid-migration from the ETHDenver-era Daytona + Telegram prototype to the hosted platform described in `ARCHITECTURE.md`. The legacy `relay-daemon.js` + `skills/*` still work as a single-tenant demo; the `apps/*` + `packages/*` scaffold is the shape the platform is moving to (Week 1 of the 10-week roadmap in `/root/.claude/plans/can-you-review-assess-cryptic-thompson.md`).

## Quick links

- `ARCHITECTURE.md` — target architecture, vendor choices, data flow.
- `packages/db/migrations/0001_initial.sql` — Supabase schema (DB + RLS + Realtime publication).
- `packages/contracts/src/` — Foundry contracts (AgentRegistry, ReputationRegistry, IdentityResolver).
- `apps/web/` — Next.js 14 hosted platform (Supabase auth, public run pages, SSE stream).
- `apps/worker/` — arena-worker (pg-boss queue, Supabase Realtime publisher, agent loop).
- `SETUP.md` — legacy Daytona-based setup for the single-tenant demo.

---

## Legacy Telegram-based demo (v0)

The original ETHDenver prototype still lives at the repo root. It's a multi-agent Telegram experiment running on [OpenClaw](https://openclaw.ai) + Telegram + Base Sepolia. Three AI agents autonomously play the [Ultimatum Game](https://en.wikipedia.org/wiki/Ultimatum_game) with real on-chain USDC transfers, configurable behavioral personas, and a reputation system.

## How It Works

A human triggers a game round in a Telegram group. Three Claude-powered agents take it from there:

1. **Researcher** (Game Master) — announces the round, assigns personas, fetches on-chain balances, records grades, posts the summary
2. **Proposer** — reads its assigned persona, checks its wallet balance and reputation, proposes a split of 1 USDC
3. **Responder** — reads its assigned persona, evaluates the offer against its behavioral parameters, accepts or rejects

If accepted, the Proposer executes an on-chain USDC transfer to the Responder on Base Sepolia. Both agents then grade each other (0-100), which feeds into a persistent reputation system. All messages include live wallet balances and Base Sepolia explorer links.

### Message Flow

```
Human: "@researcher start game proposer=shark responder=punisher"
  │
  ▼
Researcher → announces round, tags Proposer
  │
  ▼  (relay daemon bridges bot-to-bot)
Proposer → reads persona, checks wallet, proposes split
  │
  ▼  (relay daemon)
Responder → reads persona, checks wallet, accepts/rejects
  │
  ▼  (relay daemon)
Proposer → executes USDC transfer (if accepted)
  │
  ▼  (relay daemon)
Researcher → posts result, requests grades
  │
  ▼  (relay daemon)
Both agents → submit grades
  │
  ▼  (relay daemon, buffered)
Researcher → records grades, posts final summary with updated balances
```

### The Relay Daemon

Telegram's Bot API has a hard limitation: bots cannot see other bots' messages via `getUpdates`. The relay daemon (`relay-daemon.js`) solves this by monitoring each agent's session JSONL files and forwarding messages to the next agent in the chain via the `openclaw agent` CLI. It also buffers grades so the Researcher receives both at once.

**Relay daemon config (environment):**

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_GROUP_ID` | Yes | Your Telegram group chat ID (negative number, e.g. from `getUpdates`) |
| `WEBHOOK_URL` | No | Optional URL to POST structured relay payloads (e.g. for a web UI) |

Do not commit real group IDs or webhook URLs; use `.env` and keep it gitignored.

## Behavioral Personas

Personas are grounded in [Social Value Orientation (SVO)](https://en.wikipedia.org/wiki/Social_value_orientations) theory from behavioral economics. Each persona varies along three parameters:

| Persona | Type | Fairness (α) | Min Acceptable Offer | Spite (β) |
|---------|------|:---:|:---:|:---:|
| `rational` | Homo Economicus | 0.1 | 5% | 0.0 |
| `fair` | Prosocial | 0.7 | 30% | 0.3 |
| `egalitarian` | Strict Equality | 1.0 | 45% | 0.5 |
| `shark` | Competitive | 0.2 | 15% | 0.1 |
| `punisher` | Costly Signaling | 0.4 | 35% | 0.9 |

Personas are stored as skill files in `skills/personas/` and read by agents at runtime — not hardcoded into their SOUL.md.

## On-Chain Integration

All transactions happen on **Base Sepolia** testnet:

- **USDC Contract:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Explorer:** https://sepolia.basescan.org
- **Agent Identities:** ERC-8004 standard

### Agent Wallets

| Agent | ID | Wallet |
|-------|:--:|--------|
| Researcher | #931 | `0x4B727B5947AEDb36545cCBDC16E2a81B837C0103` |
| Proposer | #932 | `0xB4305A685E7370b170F5005A4efd268e3DdB2A6E` |
| Responder | #933 | `0x328DB42692f438Ab8D9e020Ac63ebF72508e7D34` |

## Project Structure

```
├── relay-daemon.js              # Bot-to-bot message relay
├── config/
│   ├── openclaw.json            # Main config (DO NOT COMMIT — contains secrets)
│   └── openclaw.example.json    # Template with placeholder values
├── workspaces/
│   ├── researcher/SOUL.md       # Game Master identity & rules
│   ├── proposer/SOUL.md         # Proposer strategy & persona integration
│   └── responder/SOUL.md        # Responder decision logic
├── skills/
│   ├── package.json             # Shared deps (ethers v6)
│   ├── personas/                # SVO-based behavioral personas
│   │   ├── rational-maximizer.md
│   │   ├── fair-dealer.md
│   │   ├── egalitarian.md
│   │   ├── strategic-shark.md
│   │   └── punisher.md
│   ├── wallet-ops/              # On-chain USDC operations
│   │   ├── SKILL.md
│   │   └── scripts/
│   │       ├── check-balance.js
│   │       ├── check-eth.js
│   │       └── send-usdc.js
│   ├── reputation/              # Agent grading system
│   │   ├── SKILL.md
│   │   └── scripts/
│   │       ├── grade.js
│   │       └── get-reputation.js
│   └── identity-8004/           # ERC-8004 agent registry
│       ├── SKILL.md
│       └── scripts/
│           └── lookup-agent.js
├── SETUP.md                     # Full deployment guide
└── .gitignore
```

## Quick Start

See [SETUP.md](SETUP.md) for the full deployment guide covering Daytona sandbox setup, Telegram bot creation, OpenClaw configuration, and end-to-end testing.

**TL;DR:**
```bash
# 1. Create a Daytona sandbox
# 2. Install OpenClaw
npm install -g @anthropic/openclaw

# 3. Copy config template and fill in your secrets
cp config/openclaw.example.json ~/.openclaw/openclaw.json

# 4. Deploy workspace files
cp -r workspaces/researcher/* ~/.openclaw/workspace-researcher/
cp -r workspaces/proposer/* ~/.openclaw/workspace-proposer/
cp -r workspaces/responder/* ~/.openclaw/workspace-responder/

# 5. Deploy skills
cp -r skills/* ~/.openclaw/skills/
cd ~/.openclaw/skills && npm install

# 6. Set relay env and start gateway + relay
export TELEGRAM_GROUP_ID="<your-group-id>"   # Required; get from getUpdates
# export WEBHOOK_URL="https://..."           # Optional
openclaw gateway &
node relay-daemon.js &

# 7. Trigger a game in Telegram
# @researcher start game proposer=shark responder=fair
```

## Trigger Syntax

In the Telegram group, tag the researcher bot:

| Command | Effect |
|---------|--------|
| `@researcher start game` | 1 round, random personas |
| `@researcher start game 3 rounds` | 3 rounds, random personas |
| `@researcher start game proposer=shark responder=punisher` | Specific personas |
| `@researcher start game random` | Explicitly random personas |

## Skills Reference

| Skill | Command | Description |
|-------|---------|-------------|
| wallet-ops | `check-balance.js <addr>` | Query USDC balance on Base Sepolia |
| wallet-ops | `check-eth.js <addr>` | Check ETH for gas fees |
| wallet-ops | `send-usdc.js <to> <amt>` | Transfer USDC (needs WALLET_PRIVATE_KEY) |
| reputation | `grade.js <from> <to> <score> "reason"` | Record a 0-100 grade |
| reputation | `get-reputation.js <id>` | Get agent's avg score & history |
| identity-8004 | `lookup-agent.js <id>` | Look up ERC-8004 identity |

## Tech Stack

- **AI Runtime:** [OpenClaw](https://openclaw.ai) with Claude Haiku 4.5
- **Messaging:** Telegram Bot API
- **Blockchain:** Base Sepolia (L2), USDC, ERC-8004
- **Compute:** [Daytona](https://daytona.io) sandbox (Ubuntu, 2 vCPU, 4GB RAM)
- **Language:** Node.js, ethers.js v6

## License

MIT
