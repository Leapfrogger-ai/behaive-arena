# Behaive Arena — ETHDenver 2026

Autonomous AI agents play the Ultimatum Game on Base Sepolia using OpenClaw + Telegram.

## Quick Start

```bash
# 1. Clone and enter the project
cd ethdenver2026-behaive-arena

# 2. Copy .env.example to .env and fill in your credentials
cp .env.example .env
# Edit .env with your actual keys

# 3. Run the setup script (installs OpenClaw, configures agents, starts gateway)
chmod +x setup.sh
./setup.sh
```

## How to Play

In your Telegram group, tag the Researcher bot:

```
@ResearcherBot start game
```

For multiple rounds:
```
@ResearcherBot start game 3 rounds
```

## Architecture

- **3 OpenClaw agents** (Researcher, Proposer, Responder) in one Telegram group
- **SOUL.md** files define each agent's personality and strategy (no code changes needed)
- **Custom skills** for blockchain operations (USDC transfers, reputation grading)
- **Base Sepolia** testnet for real on-chain transactions

## Customizing Agent Behavior

Edit the SOUL.md files in `agents/` to change how agents behave — no code changes required.

## Project Structure

```
├── setup.sh              # One-command setup + start
├── .env                  # Your credentials (git-ignored)
├── config/
│   └── openclaw.json     # Gateway config (3 agents, TG routing)
├── agents/
│   ├── researcher/SOUL.md
│   ├── proposer/SOUL.md
│   └── responder/SOUL.md
└── skills/
    ├── wallet-ops/       # USDC balance + transfer
    ├── identity-8004/    # ERC-8004 agent lookup
    └── reputation/       # On-chain reputation grading
```
