# OpenClaw - Research Summary

## What It Is

OpenClaw is a **free, open-source, self-hosted AI agent gateway** that bridges messaging platforms (Telegram, WhatsApp, Slack, Discord, Signal, etc.) with LLMs (Claude, GPT, Gemini, DeepSeek, Llama). It runs on your own hardware and acts as an autonomous AI assistant that can execute real-world tasks.

- **Creator**: Peter Steinberger (Austrian developer, recently joined OpenAI)
- **GitHub**: [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw) - 200k+ stars, 35k+ forks
- **Docs**: [docs.openclaw.ai](https://docs.openclaw.ai)
- **Latest version**: v2026.2.6 (Feb 7, 2026)
- **Name history**: Clawdbot → Moltbot → OpenClaw (trademark issues with Anthropic)

## Installation

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

---

## Setting Up 3 Agents on Telegram (Step-by-Step)

You need **3 separate BotFather tokens** but only **one OpenClaw Gateway instance**. OpenClaw supports multiple agents and multiple Telegram bot accounts within a single process.

### Step 1: Create 3 Telegram Bots via BotFather

Message `@BotFather` on Telegram for each agent:

```
/newbot → Name: Researcher Agent → Username: researcher_mycrew_bot
/newbot → Name: Proposer Agent   → Username: proposer_mycrew_bot
/newbot → Name: Responder Agent  → Username: responder_mycrew_bot
```

Save all three tokens.

### Step 2: Disable Privacy Mode on ALL 3 Bots

For each bot in BotFather:
```
/setprivacy → Select bot → Disable
```

**Critical**: After disabling privacy mode, you must **remove the bot from the group and re-add it** for the change to take effect.

### Step 3: Create the Telegram Group

1. Create a new Telegram group
2. Add all 3 bots to the group
3. **Promote all 3 bots to admin** (required — see bot-to-bot visibility gotcha below)
4. Lock "Pin Messages" and "Change Group Info" to admins only
5. Note the group chat ID (negative number, e.g., `-1001234567890`)

### Step 4: Initialize Agent Workspaces

```bash
openclaw agents add researcher
openclaw agents add proposer
openclaw agents add responder
```

Or manually:
```bash
mkdir -p ~/.openclaw/workspace-researcher
mkdir -p ~/.openclaw/workspace-proposer
mkdir -p ~/.openclaw/workspace-responder
```

### Step 5: Configure `openclaw.json`

Full configuration for 3 agents sharing one Telegram group:

```json5
{
  // === AGENT DEFINITIONS ===
  "agents": {
    "defaults": {
      "model": { "primary": "anthropic/claude-sonnet-4-5" }
    },
    "list": [
      {
        "id": "researcher",
        "workspace": "~/.openclaw/workspace-researcher",
        "name": "Researcher",
        "identity": { "name": "Researcher" },
        "groupChat": {
          "mentionPatterns": ["@researcher_mycrew_bot", "@researcher", "Researcher"]
        },
        "tools": {
          "agentToAgent": { "enabled": true, "allow": ["proposer", "responder"] }
        }
      },
      {
        "id": "proposer",
        "workspace": "~/.openclaw/workspace-proposer",
        "name": "Proposer",
        "identity": { "name": "Proposer" },
        "groupChat": {
          "mentionPatterns": ["@proposer_mycrew_bot", "@proposer", "Proposer"]
        },
        "tools": {
          "agentToAgent": { "enabled": true, "allow": ["researcher", "responder"] }
        }
      },
      {
        "id": "responder",
        "workspace": "~/.openclaw/workspace-responder",
        "name": "Responder",
        "identity": { "name": "Responder" },
        "groupChat": {
          "mentionPatterns": ["@responder_mycrew_bot", "@responder", "Responder"]
        },
        "tools": {
          "agentToAgent": { "enabled": true, "allow": ["researcher", "proposer"] }
        }
      }
    ]
  },

  // === BINDINGS: Route each bot token to its agent ===
  "bindings": [
    { "agentId": "researcher", "match": { "channel": "telegram", "accountId": "researcher" } },
    { "agentId": "proposer", "match": { "channel": "telegram", "accountId": "proposer" } },
    { "agentId": "responder", "match": { "channel": "telegram", "accountId": "responder" } }
  ],

  // === TELEGRAM CHANNEL CONFIG ===
  "channels": {
    "telegram": {
      "enabled": true,
      "groupPolicy": "open",
      "accounts": {
        "researcher": {
          "botToken": "${RESEARCHER_BOT_TOKEN}",
          "dmPolicy": "pairing"
        },
        "proposer": {
          "botToken": "${PROPOSER_BOT_TOKEN}",
          "dmPolicy": "pairing"
        },
        "responder": {
          "botToken": "${RESPONDER_BOT_TOKEN}",
          "dmPolicy": "pairing"
        }
      },
      "groups": {
        "-1001234567890": {
          "requireMention": false,
          "groupPolicy": "open"
        }
      }
    }
  },

  // === SESSION SETTINGS ===
  "session": {
    "agentToAgent": {
      "maxPingPongTurns": 5
    }
  }
}
```

### Step 6: Create Per-Agent Workspace Files

Each agent gets its own `SOUL.md` (persona) and `AGENTS.md` (operating instructions):

**Workspace directory structure:**
```
~/.openclaw/workspace-{agentId}/
  AGENTS.md          # Operating instructions and rules
  SOUL.md            # Persona, tone, boundaries
  USER.md            # Human context (optional)
  TOOLS.md           # Tool usage guidance (optional)
  IDENTITY.md        # Name and identity details (optional)
  memory/            # Agent-specific memory storage
  skills/            # Skill bundles (optional)
```

The `SOUL.md` is where human-authored system prompts go — this is the file that defines each agent's personality, strategy, and decision-making approach.

### Step 7: Start and Verify

```bash
# Restart the Gateway to apply changes
openclaw gateway restart

# Verify all agents and channels are up
openclaw agents list --bindings
openclaw channels status --probe

# Pair with each bot (send /start to each in Telegram DM)
# Approve pairing from Gateway logs

# Health check
openclaw doctor
```

---

## Group Chat Interaction Approaches

### Approach A: Autonomous (requireMention: false)

All 3 bots see all messages and respond based on their SOUL.md persona. Most natural for a demo, but risks **infinite loops** (Agent A responds to Agent B, triggering Agent C, triggering Agent A...).

**Loop prevention:**
- Explicit SOUL.md rules: "Only respond when directly relevant to your role"
- `REPLY_SKIP` mechanism — agents reply with exactly `REPLY_SKIP` to abstain
- Rate limiting via Lobstalk skill (frequency + daily message caps)

### Approach B: Mention-Based Handoffs (requireMention: true)

Agents only respond when @mentioned. The researcher starts the game, tags `@proposer_mycrew_bot`, the proposer makes an offer and tags `@responder_mycrew_bot`, etc. Controlled and predictable.

### Approach C: Coordinator Pattern

One "coordinator" bot faces the group. The other agents work behind the scenes using OpenClaw's built-in A2A tools (`sessions_spawn`, `sessions_send`). Only one bot visible in Telegram, but no loop risk.

**For the Ultimatum Game, Approach A or B is recommended** — having all three agents visibly interact in the group is the whole point of the demo.

---

## Agent-to-Agent Communication

### Built-in A2A Messaging

Off by default, must be explicitly enabled per agent:

```json5
tools: {
  agentToAgent: {
    enabled: true,
    allow: ["agent-a", "agent-b"]
  }
}
```

- **`sessions_send`**: Direct synchronous messaging between agents (max `maxPingPongTurns` rounds, default 5)
- **`sessions_spawn`**: Spawn a task to a sub-agent in an isolated session

### Lobstalk Skill (Optional)

Community skill for casual agent group chat: [github.com/coolishagent/lobstalk](https://github.com/coolishagent/lobstalk)

- Adds rate limiting, daily message caps, language settings
- Security: anti-injection, identity protection, social engineering defense
- **Not required** for task-oriented agent teams — use built-in multi-agent config instead
- Install by telling each agent: `Read https://raw.githubusercontent.com/coolishagent/lobstalk/main/SKILL.md and join lobstalk`

---

## DM Access Control

| Policy | Behavior |
|--------|----------|
| `pairing` (default) | Unknown users get one-time approval code |
| `allowlist` | Only specified Telegram user IDs |
| `open` | Anyone can DM |
| `disabled` | No DMs |

---

## Routing Priority

1. Specific peer match (exact DM/group ID)
2. Parent peer match (thread inheritance)
3. Channel-level match
4. Default agent fallback

---

## Transport: Long Polling vs Webhook

**Long Polling (default, recommended for multi-bot):** Each bot account gets its own outbound polling connection. No port conflicts.

**Webhook mode:** Each bot needs a unique webhook path to avoid conflicts:
```json5
"accounts": {
  "researcher": { "botToken": "TOKEN_1", "webhookUrl": "https://example.com/webhook-researcher" },
  "proposer":   { "botToken": "TOKEN_2", "webhookUrl": "https://example.com/webhook-proposer" },
  "responder":  { "botToken": "TOKEN_3", "webhookUrl": "https://example.com/webhook-responder" }
}
```

**Never run the same bot token in two Gateway instances** — causes "Conflict: terminated by other getUpdates request" error.

---

## Critical Gotchas

### 1. Bot-to-Bot Visibility Requires Admin
Telegram bots **cannot see messages from other bots** in standard groups. This is a platform-level restriction. The only workaround is to **make each bot a group admin**.

### 2. Message Processing Bottleneck
All inbound messages from different Telegram accounts queue into a single "main lane" with a default concurrency cap of 4. With 3 agents responding simultaneously, expect 1-2 minute delays. ([Issue #16055](https://github.com/openclaw/openclaw/issues/16055))

### 3. Config Override Behavior
Agent-specific fields override defaults **entirely** (no deep merge). If you set `tools` on a specific agent, it replaces the entire `tools` object from defaults.

### 4. `agentToAgent` + `sessions_spawn` Conflict
Enabling `tools.agentToAgent.enabled: true` can break `sessions_spawn`. ([Issue #5813](https://github.com/openclaw/openclaw/issues/5813)). Test carefully if using both.

### 5. Infinite Loop Risk
With `requireMention: false` and 3 bots, each agent's response can trigger the others endlessly. Mitigate with SOUL.md rules, mention-based handoffs, or rate limiting.

### 6. Context Window Exhaustion in Groups
Long group conversations cause compaction issues. Solutions: use Telegram forum topics (each = isolated session), maintain a shared `STATE.md`, or use periodic `/compact` commands.

---

## Security

- **Sandboxing**: Docker-based, configurable per agent (`off`, `non-main`, `all`)
- **Tool restrictions**: Per-agent allow/deny lists
- **Group chat safety**: Chat-only mode, anti-injection, identity protection
- **Skill scanning**: VirusTotal integration (v2026.2.6)

## Crypto/DeFi Skills

- **BankrBot Skills**: Trade crypto, transfer, manage NFTs, deploy tokens on Base/Ethereum/Polygon/Solana
- **Polyclaw**: Polymarket trading on Polygon

## Key Links

- **GitHub**: [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
- **Docs**: [docs.openclaw.ai](https://docs.openclaw.ai)
- **Telegram Docs**: [docs.openclaw.ai/channels/telegram](https://docs.openclaw.ai/channels/telegram)
- **Multi-Agent Docs**: [docs.openclaw.ai/concepts/multi-agent](https://docs.openclaw.ai/concepts/multi-agent)
- **ClawHub (Skills)**: [github.com/openclaw/clawhub](https://github.com/openclaw/clawhub)
- **Lobstalk**: [github.com/coolishagent/lobstalk](https://github.com/coolishagent/lobstalk)
