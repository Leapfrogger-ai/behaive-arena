# Architecture

The hosted Behaive Arena platform is a two-vendor, zero-monthly-cost stack designed for a research audience (behavioral econ / AI alignment labs, ETH Foundation grants, crypto-AI pre-seed VCs).

## Stack

| Concern | Tool | Notes |
|---|---|---|
| Compute (web + worker) | **Daytona** sandboxes | Using existing $200 credit + 5 GB storage. Persistent sandboxes with public URLs; fallback to Oracle Always Free if this underperforms. |
| DB + Auth + Storage + Realtime + Vault | **Supabase** free tier | 500 MB DB, 50K MAU auth, 1 GB storage, Realtime channels, pgsodium Vault. |
| Blockchain RPC | **Alchemy** free | 300M compute units/mo for Base Sepolia. |
| Contracts | **Foundry** (local) | AgentRegistry, ReputationRegistry, IdentityResolver. |
| Queue | **pg-boss** | Postgres-backed; no Redis needed. |
| Live stream | Supabase Realtime + SSE fallback | Browser subscribes directly; server-side SSE for clients that can't open a websocket. |
| BYO model keys | Supabase **Vault (pgsodium)** | Envelope encryption. Plaintext never touches the DB. |

Why not Vercel / Fly.io / Neon / Clerk / Upstash / AWS KMS? See the vendor audit in `/root/.claude/plans/can-you-review-assess-cryptic-thompson.md` §4. TL;DR: Vercel Hobby forbids commercial use, Fly.io removed its free tier for new signups, and consolidating on Supabase collapses 4 vendors into 1 at the same zero cost.

## Topology

```
Researcher browser
  ↓ Supabase Auth (magic link)
Next.js 14 on Daytona sandbox ─── SSE /api/runs/:id/stream ─┐
  ↓ Route Handlers                                          │
Supabase Postgres ◀── LISTEN/NOTIFY ── Supabase Realtime ───┤
  ↑  (pg-boss queue, Vault, Storage for transcripts)        │
  │
arena-worker on Daytona sandbox (long-running)
  ↓
Base Sepolia via Alchemy ─► AgentRegistry / ReputationRegistry / USDC
Provider SDKs (Anthropic / OpenAI / Gemini) — BYO keys decrypted from Vault per run
Optional Telegram mirror (outbound webhook only)
```

## Monorepo layout

```
apps/
  web/                    # Next.js 14, Supabase Auth, public /run/[slug]
  worker/                 # arena-worker (pg-boss), fake-runner for W1 validation
packages/
  contracts/              # Foundry: AgentRegistry, ReputationRegistry, IdentityResolver
  chain/                  # viem helpers (USDC, registries, EIP-712 sign helpers)
  db/                     # Drizzle schema + migrations (Supabase-ready SQL)
```

## Data model

All tenant tables sit under a `org` FK and carry an RLS policy gated on `public.is_org_member(org_id)`. Public run pages (visibility `public`/`unlisted`) add an additional anon-readable policy on `runs` + children so `/run/[slug]` doesn't require a session.

Hot path tables:
- `runs` — one per experiment execution. Frozen `config_snapshot` is the reproducibility anchor.
- `messages` — every agent turn, with `event_type` (`offer` / `response` / `verdict` / `chat` / `game_start`) and optional structured `payload`. Realtime publication is enabled; the browser subscribes to `INSERT` events filtered by `run_id`.
- `reputation_events` — Postgres read cache; the source of truth is the on-chain event log emitted by `ReputationRegistry`.
- `byo_keys` — ciphertext only. Plaintext lives only inside the worker's RAM for the duration of a single run.

## Contracts

- **AgentRegistry** — `registerAgent(metadataHash) → agentId`. Monotonic ids, wallet-scoped.
- **ReputationRegistry** — platform-signer pattern: agents sign EIP-712 `Feedback` inner payloads; one hot platform relay calls `submitFeedbackBatch`. Agents never touch gas.
- **IdentityResolver** — view-only convenience (`agentId → (wallet, metadataHash)`), kept separate so the read surface can evolve (Merkle metadata roots, etc.) without touching the canonical registry.

## Running locally

```bash
# One-time
pnpm install
cp .env.example .env && $EDITOR .env   # fill in Supabase + Alchemy

# Apply schema
psql "$SUPABASE_DB_URL" -f packages/db/migrations/0001_initial.sql
psql "$SUPABASE_DB_URL" -f packages/db/migrations/0002_seed_demo.sql

# Contracts (requires Foundry: https://book.getfoundry.sh/)
cd packages/contracts && forge install foundry-rs/forge-std && forge test

# Web + worker
pnpm --filter @behaive/web dev       # :3000
pnpm --filter @behaive/worker dev

# Fake runner to validate the SSE / Realtime path
pnpm --filter @behaive/worker fake-run
```

## Trade-offs accepted

- **Supabase 7-day inactivity pause** — a GitHub Actions cron hits `/api/healthz` every 3 days to keep the free-tier project warm.
- **Supabase 500 MB DB** — completed-run transcripts snapshot to Supabase Storage; `messages` hot table purges old runs on a cadence.
- **Daytona as long-running host** — Daytona is primarily an AI-sandbox product; long-running + public URLs work today, but a fallback to Oracle Always Free is planned if stability falls short past the $200 credit.
- **No Redis** — pub/sub rides Postgres `LISTEN/NOTIFY` + Supabase Realtime. Acceptable at 3–10 concurrent runs; revisit if load grows.

See `/root/.claude/plans/can-you-review-assess-cryptic-thompson.md` for the full 10-week roadmap, vendor audit, and risk register.
