# End-to-End Local Bootstrap

This document captures the exact sequence used to run the Behaive Arena stack on a single Linux box with zero external services. A full Ultimatum Game — multiple rounds, ephemeral wallets, ERC-8004 registration, on-chain USDC transfers, EIP-712 signed reputation batched on-chain, live SSE fan-out — runs against a local Postgres + anvil in under a second.

## Toolchain

- Node 22, pnpm 9
- Postgres 16 (apt: `postgresql-16`)
- Foundry 1.5.1 (downloaded binary tarball; toolchain installer is not network-reachable in some sandboxes)
- solc 0.8.27 (downloaded from GitHub releases; placed under `~/.svm/0.8.27/solc-0.8.27` so forge can find it offline)

## Steps

```bash
# 1. Postgres: start the default cluster and create the app DB
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER behaive WITH PASSWORD 'behaive' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE behaive_arena OWNER behaive;"

# 2. Apply schema + seed
export PGPASSWORD=behaive
psql -h 127.0.0.1 -U behaive -d behaive_arena -f packages/db/migrations/0001_initial.sql
psql -h 127.0.0.1 -U behaive -d behaive_arena -f packages/db/migrations/0002_seed_demo.sql

# 3. Contracts: validate the suite, then deploy to a fresh anvil
cd packages/contracts
/root/.foundry/bin/forge test --offline -vv        # 10/10 tests should pass
/root/.foundry/bin/anvil --host 0.0.0.0 --port 8545 --chain-id 31337 &
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  /root/.foundry/bin/forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 --broadcast --offline
# Capture the four addresses that are logged — write them into .env.local
cd ../..

# 4. Boot the app
pnpm install
cp .env.example .env                   # override with anvil values shown in the deploy output
set -a && source .env.local && set +a
pnpm --filter @behaive/web dev &       # :3000
# (optional) kick a job-based loop via pg-boss
# pnpm --filter @behaive/worker dev

# 5. Run a game end-to-end against anvil + Postgres
pnpm --filter @behaive/worker run-game     # creates a demo run and plays it
# or run an existing queued row:
# pnpm --filter @behaive/worker run-game <runId>
```

Open `http://127.0.0.1:3000/` → see the list of public runs. Click one → every offer, response, on-chain transfer, grade, and confirmed reputation receipt streams in live over SSE.

## What the run exercises

Each call to `run-game` walks through the whole canonical arena:

1. Mints two ephemeral wallets. Funds each with 0.01 ETH for gas + an endowment of MockUSDC minted from the funder account.
2. Registers each wallet against `AgentRegistry` and records the returned `agentId`.
3. For each round:
   * Proposer's persona selects an offer amount; `messages` row is inserted → Postgres trigger `pg_notify`s the run channel → SSE handler forwards to every open listener.
   * Responder's persona decides accept/reject.
   * On accept, a real ERC-20 `transfer` is broadcast to MockUSDC; tx hash is published with the `transfer` event.
   * Both parties grade the round; grade payload is streamed.
4. After the last round, each party signs an EIP-712 `Feedback` per round. The platform signer calls `submitFeedbackBatch` in one transaction; receipt is waited for and confirmed rows are written to `reputation_events` as a read cache.
5. Run is flipped to `completed`, final USDC balances are streamed as the `run_complete` event, and `pg_notify` fires on the runs table so the page's status badge flips from "running" to "completed" without a refresh.

Verified scenarios (deterministic via the mulberry32 seed in the config):

| persona (proposer → responder) | result | transfers | reputation signal |
|---|---|---|---|
| `fair` → `rational` | 3/3 accepted, 15/15 split | 3 txs | cooperation +40, fairness +80 |
| `egalitarian` → `punisher` | 3/3 accepted, mostly 4-5/10 offers | 3 txs | cooperation +40, fairness +40 |
| `shark` → `punisher` | 0/3 accepted (Fehr-Schmidt punishment) | 0 txs | cooperation -10, fairness -70 to -20 |

The persona-driven mock model is a drop-in for the real Claude adapter (see `apps/worker/src/personas.ts`). Once `ANTHROPIC_API_KEY` is provided and `MODEL_PROVIDER=anthropic`, the same orchestrator will drive actual Claude turns without any change to the database, contracts, SSE, or UI.

## What the run proves

- Postgres `LISTEN/NOTIFY` is a drop-in replacement for Supabase Realtime for research-grade volume.
- Vanilla `postgres` + Drizzle + cookie sessions covers every data-access path we'd have needed Supabase for.
- ERC-8004 agent identity + EIP-712 batched reputation is cheap: six signed feedbacks land in one transaction, ~90k gas, no per-event fees.
- The same codebase runs unchanged against anvil (CHAIN_ID=31337) and Base Sepolia (84532); swap RPC + contract addresses in `.env` and the worker lights up on real testnet.

## Known limits

- Session auth is dev-only (magic-link / OIDC lands in W6 per the plan).
- Experiment config UI (W6) is still missing — runs are currently created via SQL or the CLI.
- BYO model keys + envelope encryption (W7) is schema-only; no UI or decryption path yet.
- The persona mock is sufficient for infrastructure validation and for the Fehr–Schmidt replication rehearsal; for the published dataset we'll swap in Anthropic + OpenAI adapters and rerun.
