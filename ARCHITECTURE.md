# Architecture

The hosted Behaive Arena platform is a **sovereign, zero-external-service** stack: vanilla Postgres, local Ethereum (Foundry/anvil for dev, Base Sepolia for staging), and a Next.js + Node worker pair. Nothing the project depends on is proprietary, and every service runs on a commodity Linux box. An earlier draft targeted Supabase; the vanilla-Postgres rewrite is the one in the tree.

## Stack

| Concern | Tool | Notes |
|---|---|---|
| Database | **Postgres 16** | Schema + `LISTEN/NOTIFY` triggers + cookie sessions. Zero extensions required beyond `pgcrypto` + `uuid-ossp`. |
| Compute (web + worker) | Node 22 on **Daytona** sandboxes / Oracle Always Free | Web: Next.js dev server. Worker: long-running tsx / compiled dist. |
| Blockchain RPC | **Alchemy** (Base Sepolia staging) / **anvil** (local dev) | Chain id env-selectable in `packages/chain/src/client.ts`. |
| Contracts | **Foundry** + solc 0.8.27 | AgentRegistry, ReputationRegistry, IdentityResolver, MockUSDC (dev only). |
| Queue | **pg-boss** | Postgres-backed; no Redis. |
| Live stream | Postgres `pg_notify` + Next.js Route Handler SSE | Each message insert fires `pg_notify('run:<id>', …)`; SSE subscribes via a dedicated connection per client. |
| Auth | Cookie sessions (`public.sessions` + HMAC token hash) | Dev auto-login in place; magic-link / OIDC lands in W6. |
| BYO model keys (W7) | libsodium sealed boxes | Schema exists; crypto path is TODO. |

## Monorepo

```
apps/
  web/                    # Next.js 14 — public /run/[slug], SSE fan-out, home page, dev auth
  worker/                 # arena-worker — pg-boss consumer + run-game orchestrator + personas
packages/
  contracts/              # Foundry: AgentRegistry, ReputationRegistry, IdentityResolver, MockUSDC
  chain/                  # viem helpers: USDC transfer, EIP-712 signFeedback, registry writes
  db/                     # Drizzle schema, migration SQL, shared pg/drizzle/listener helpers
```

## Topology

```
Researcher browser
  ↓ Next.js app (/run/[slug])
  │     ↕ /api/runs/[id]/stream  — SSE, LAST-EVENT-ID aware
Next.js route handler on Daytona
  ↓ drizzle + postgres.js
Postgres 16
  ↕ pg_notify('run:<id>', payload)      ← emitted by messages/runs triggers
arena-worker on Daytona sandbox
  ↓ pg-boss → runGame(runId)
  ↓ viem
Base Sepolia / anvil ─► AgentRegistry / ReputationRegistry / (Mock)USDC
Provider SDKs (W7) — Anthropic / OpenAI / Gemini
```

## Data model

Every tenant table references `public.users.id` directly (no Supabase `auth.*`). Tenancy is enforced in the application layer via a `SET LOCAL app.user_id = '…'` GUC set from the session cookie; the `public.is_org_member()` helper reads that GUC. Public-run access is an explicit visibility enum check, not an RLS policy.

Hot path:
- `runs` — one per execution. `config_snapshot` is the frozen reproducibility anchor.
- `messages` — every turn, event-typed. INSERT trigger emits `pg_notify('run:<id>', payload)` with a 4 KB snippet + structured fields. Hand-offs stay under Postgres's 8 KB `NOTIFY` cap even with long utterances.
- `reputation_events` — read cache of on-chain `FeedbackSubmitted` events.

## Contracts

- **AgentRegistry** — `registerAgent(metadataHash) → agentId`, wallet-scoped.
- **ReputationRegistry** — platform-signer pattern. Each round each party signs an EIP-712 `Feedback`. The platform signer submits `submitFeedbackBatch` once per run. Nonces protect against replay; scores range -100..100.
- **IdentityResolver** — view-only (`agentId → (wallet, metadataHash)`), so alternative read strategies (Merkle roots, etc.) can be added without touching the canonical registry.
- **MockUSDC** — dev only, open mint. Real runs against Base Sepolia use Circle's `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

## Live observability

The SSE route (`apps/web/src/app/api/runs/[id]/stream/route.ts`) spins up one dedicated Postgres connection per subscriber, LISTENs to the run's channel, and forwards every notification as an SSE event keyed by the message id. On reconnect the client reads `Last-Event-ID` (or `?since=N`) and the route replays missed rows from `messages` before re-subscribing — so there's no gap even across proxy drops.

## Running locally

See [E2E.md](./E2E.md) for the full reproducible bootstrap. TL;DR:

```bash
sudo pg_ctlcluster 16 main start
psql -f packages/db/migrations/0001_initial.sql behaive_arena
/root/.foundry/bin/anvil &
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
pnpm install && pnpm --filter @behaive/web dev
pnpm --filter @behaive/worker run-game
```

Open `http://127.0.0.1:3000/run/<slug>` and watch the arena run live.

## Trade-offs accepted

- **No RLS on hot tables** — multi-tenant isolation is enforced in the query layer. Simpler to reason about and avoids the tenant-leak class of RLS-policy bugs; the cost is that the worker must bypass tenancy explicitly when it legitimately has to, which is already the case.
- **Persona-driven mock model as the default** — until BYO model keys land in W7, runs use deterministic persona logic. This is a feature for the methodology-paper's reproducibility narrative: every persona run can be re-executed bit-for-bit from the stored seed, while the Anthropic / OpenAI integration in W7 swaps in a stochastic-but-versioned model on top of the same orchestrator.
- **Base Sepolia + anvil, no mainnet** — research substrate, not a trading venue. Gas is irrelevant; testnet faucet throttling is the only real operational worry.

See `/root/.claude/plans/can-you-review-assess-cryptic-thompson.md` for the full 10-week roadmap.
