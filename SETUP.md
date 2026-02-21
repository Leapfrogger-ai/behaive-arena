# Setup Guide

Complete step-by-step guide to deploy the OpenClaw Ultimatum Game from scratch.

## Prerequisites

- A [Daytona](https://daytona.io) account (or any Ubuntu server with Node.js 18+)
- An [Anthropic API key](https://console.anthropic.com) for Claude
- Telegram account
- Base Sepolia ETH for gas (free from faucets)
- Base Sepolia USDC for game stakes

## 1. Create the Daytona Sandbox

### 1.1 Create a sandbox via the Daytona dashboard

Go to [app.daytona.io](https://app.daytona.io) and create a new sandbox:

- **Image:** Ubuntu 22.04
- **Resources:** 2 vCPU, 4GB RAM (minimum)
- **Region:** Any

Note your **Sandbox ID** (UUID) from the dashboard URL and generate an **API key** under Settings > API Keys.

### 1.2 Accessing the sandbox

All commands run via the Daytona Toolbox API:

```bash
SANDBOX_ID="your-sandbox-id"
API_KEY="your-api-key"

# Execute a command
curl -s -X POST "https://proxy.app.daytona.io/toolbox/${SANDBOX_ID}/process/execute" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"command":"echo hello"}'
```

The response is JSON with `exitCode` and `result` fields.

> **Note:** The Daytona API does not support shell operators directly. Wrap complex commands in `bash -c "..."`.

## 2. Create Telegram Bots

You need **3 Telegram bots** — one per agent.

### 2.1 Create bots via BotFather

Open [@BotFather](https://t.me/BotFather) in Telegram and create 3 bots:

```
/newbot
Name: Researcher Game Master
Username: your_researcher_bot

/newbot
Name: Proposer Agent
Username: your_proposer_bot

/newbot
Name: Responder Agent
Username: your_responder_bot
```

Save the **bot tokens** for each.

### 2.2 Disable privacy mode

For each bot, tell BotFather:

```
/mybots → select bot → Bot Settings → Group Privacy → Turn OFF
```

This lets bots see all group messages (needed for the Researcher to receive human triggers).

### 2.3 Create a Telegram group

1. Create a new Telegram group
2. Add all 3 bots to the group
3. Make all 3 bots **admins** (required for posting)
4. Send any message in the group — this may trigger a migration to a **supergroup**
5. Get the **group chat ID** (it will be a negative number like `-1001234567890`)

**How to get the group ID:** After adding the bots, send a message and check:
```bash
curl "https://api.telegram.org/bot<RESEARCHER_TOKEN>/getUpdates" | jq '.result[-1].message.chat.id'
```

If the group migrated to a supergroup, use the `migrate_to_chat_id` value instead.

### 2.4 Update SOUL.md bot usernames

The SOUL.md files reference bot usernames in their message templates (e.g., `@proposer26_bot`). Update these to match your actual bot usernames in:

- `workspaces/researcher/SOUL.md` — references both `@proposer_bot` and `@responder_bot`
- `workspaces/proposer/SOUL.md` — references `@responder_bot`
- `workspaces/responder/SOUL.md` — references `@proposer_bot`

### 2.5 Update relay-daemon.js bot usernames

The relay daemon pattern-matches on bot usernames to route messages. Update the `shouldRelayToProposer()` and `shouldRelayToResponder()` functions in `relay-daemon.js` to use your bot usernames:

```javascript
// Change these to match your bot usernames
function shouldRelayToProposer(text) {
  return (
    text.includes("@your_proposer_bot") &&
    (text.includes("propose") || text.includes("ULTIMATUM") || ...)
  );
}

function shouldRelayToResponder(text) {
  return (
    text.includes("@your_responder_bot") &&
    (text.includes("PROPOSAL") || text.includes("USDC") || ...)
  );
}
```

Also update the `senderMap` in `triggerAgent()`:
```javascript
const senderMap = {
  researcher: "@your_researcher_bot (the Researcher/Game Master)",
  proposer: "@your_proposer_bot (the Proposer)",
  responder: "@your_responder_bot (the Responder)",
};
```

## 3. Fund Wallets on Base Sepolia

### 3.1 Get Base Sepolia ETH (for gas)

Use a faucet to get free testnet ETH:

- [Alchemy Sepolia Faucet](https://sepoliafaucet.com) — bridge to Base Sepolia
- [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)

Fund at least the **Proposer wallet** (`0xB430...2A6E`) with ~0.01 ETH for gas.

### 3.2 Get Base Sepolia USDC

The USDC contract on Base Sepolia is: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

Options:
- Use [Circle's testnet faucet](https://faucet.circle.com/) to mint test USDC
- Transfer from another funded wallet

Fund the **Proposer wallet** with enough USDC for your planned rounds (1 USDC per round).

### 3.3 Verify balances

```bash
node skills/wallet-ops/scripts/check-balance.js 0xB4305A685E7370b170F5005A4efd268e3DdB2A6E
node skills/wallet-ops/scripts/check-eth.js 0xB4305A685E7370b170F5005A4efd268e3DdB2A6E
```

## 4. Install OpenClaw

SSH into your sandbox (or use the Daytona API) and install OpenClaw:

```bash
# Install OpenClaw CLI globally
npm install -g @anthropic/openclaw

# Verify installation
openclaw --version
```

### 4.1 Set your Anthropic API key

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or configure it in the OpenClaw config. The agents use Claude Haiku 4.5 by default (cost-effective for game interactions).

## 5. Deploy Project Files

### 5.1 Config

```bash
# Copy the example config and fill in your values
cp config/openclaw.example.json ~/.openclaw/openclaw.json
```

Edit `~/.openclaw/openclaw.json` and replace:

| Placeholder | Value |
|-------------|-------|
| `YOUR_RESEARCHER_BOT_TOKEN` | Telegram bot token from BotFather |
| `YOUR_PROPOSER_BOT_TOKEN` | Telegram bot token from BotFather |
| `YOUR_RESPONDER_BOT_TOKEN` | Telegram bot token from BotFather |
| `YOUR_TELEGRAM_GROUP_ID` | Group chat ID (negative number) |
| `YOUR_GATEWAY_AUTH_TOKEN` | Any random string (e.g., `openssl rand -hex 24`) |

### 5.2 Agent workspaces

```bash
# Create workspace directories
mkdir -p ~/.openclaw/workspace-{researcher,proposer,responder}

# Deploy SOUL.md files
cp workspaces/researcher/SOUL.md ~/.openclaw/workspace-researcher/
cp workspaces/proposer/SOUL.md ~/.openclaw/workspace-proposer/
cp workspaces/responder/SOUL.md ~/.openclaw/workspace-responder/
```

### 5.3 Skills

```bash
# Deploy all skills
cp -r skills/personas ~/.openclaw/skills/
cp -r skills/wallet-ops ~/.openclaw/skills/
cp -r skills/reputation ~/.openclaw/skills/
cp -r skills/identity-8004 ~/.openclaw/skills/
cp skills/package.json ~/.openclaw/skills/

# Install dependencies (ethers.js)
cd ~/.openclaw/skills && npm install
```

### 5.4 Set environment variables

The Proposer agent needs a private key to execute USDC transfers:

```bash
export PROPOSER_PRIVATE_KEY="0x..."
```

This key must correspond to the Proposer's wallet address (`0xB4305A685E7370b170F5005A4efd268e3DdB2A6E`). **Never commit this key.**

## 6. Start the Gateway and Relay

### 6.1 Start the OpenClaw gateway

```bash
# Start in background
nohup openclaw gateway > ~/gateway.log 2>&1 &
echo "Gateway PID: $!"

# Verify it's running
sleep 3 && tail -5 ~/gateway.log
```

The gateway connects your Telegram bots to the OpenClaw agent runtime.

### 6.2 Deploy and start the relay daemon

```bash
# Copy relay daemon
cp relay-daemon.js ~/relay-daemon.js

# Set your Telegram group ID (required); optional: WEBHOOK_URL for relay payloads
export TELEGRAM_GROUP_ID="YOUR_GROUP_ID"   # e.g. -1001234567890

# Start in background
nohup node ~/relay-daemon.js > ~/relay.log 2>&1 &
echo "Relay PID: $!"

# Verify it's running
sleep 2 && tail -10 ~/relay.log
```

You should see:
```
[relay ...] 🚀 Relay daemon v2 starting...
[relay ...]    Group: -100XXXXXXXXXX
[relay ...]    Poll interval: 2500ms
[relay ...] 👂 Listening for agent messages...
```

## 7. End-to-End Test

### 7.1 Trigger a game

In the Telegram group, send:

```
@your_researcher_bot start game proposer=rational responder=fair
```

### 7.2 Expected flow

You should see this sequence in the group chat (each message takes 10-30 seconds):

1. **Researcher** posts game announcement with on-chain balances and explorer links
2. **Proposer** posts a proposal (e.g., "I keep 0.75 USDC, Responder gets 0.25 USDC")
3. **Responder** posts accept/reject decision with reasoning
4. **Proposer** executes USDC transfer (if accepted) and posts tx link
5. **Researcher** posts round result, asks for grades
6. **Both agents** post grades (0-100)
7. **Researcher** posts final summary with updated balances and reputation scores

### 7.3 Monitor the relay

Watch the relay log for message routing:

```bash
tail -f ~/relay.log
```

You should see entries like:
```
[relay ...] 📨 Researcher → Proposer: game start
[relay ...] ✅ proposer responded: 💰 [Proposer #932 | ...]
[relay ...] 📨 Proposer → Responder: proposal
[relay ...] ✅ responder responded: 🎯 [Responder #933 | ...]
[relay ...] 📨 Responder → Proposer: ACCEPTED
[relay ...] 📨 Responder → Researcher: round result
```

### 7.4 Verify on-chain

After an accepted round, check the transfer on Base Sepolia:
- Proposer balance: `node ~/.openclaw/skills/wallet-ops/scripts/check-balance.js 0xB4305A685E7370b170F5005A4efd268e3DdB2A6E`
- Responder balance: `node ~/.openclaw/skills/wallet-ops/scripts/check-balance.js 0x328DB42692f438Ab8D9e020Ac63ebF72508e7D34`
- Transaction: check the explorer link posted by the Proposer

### 7.5 Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Researcher posts but Proposer never responds | Relay not running | Check `tail ~/relay.log`, restart relay |
| Proposer responds but Responder doesn't | Bot username mismatch in relay | Check `shouldRelayToResponder()` uses correct `@username` |
| Responder accepts but no transfer happens | `isAcceptance()` case mismatch | Relay v2 handles case-insensitive — verify you have latest relay |
| "No ETH for gas" error | Proposer wallet has no ETH | Fund with Base Sepolia ETH from faucet |
| "Insufficient USDC balance" | Proposer wallet low on USDC | Fund with test USDC |
| Gateway won't start (lock file) | Stale PID lock | `pkill -f openclaw-gateway && find /tmp -name "gateway*lock" -delete` |
| Agent gives "NO_REPLY" | Missing sender context | Ensure relay adds `[Message from ...]` prefix |
| Persona file not found (ENOENT) | Relative path resolution | SOUL.md uses `~/.openclaw/skills/personas/...` (absolute) |
| Grades arrive one at a time | Old relay without buffering | Ensure relay has `bufferGrade()`/`flushGrades()` functions |

## 8. Customization

### Change the model

Edit `config/openclaw.json`, change `agents.defaults.model.primary`:

```json
"model": {
  "primary": "anthropic/claude-sonnet-4-5"
}
```

Haiku 4.5 is ~10x cheaper and 3-5x faster than Sonnet. Sonnet produces more nuanced persona behaviors.

### Add new personas

Create a new `.md` file in `skills/personas/` following the existing format:

```markdown
# Persona: Your Persona Name

**Type:** Description | **SVO:** Category

## Parameters
- Fairness weight (α): 0.0-1.0
- Minimum Acceptable Offer: 0-50%
- Spite tolerance (β): 0.0-1.0

## As Proposer
How to propose...

## As Responder
How to evaluate offers...

## Reasoning style
Communication voice...
```

Then add the keyword mapping to both `workspaces/proposer/SOUL.md` and `workspaces/responder/SOUL.md`.

### Change the endowment

Update the endowment amount in `workspaces/researcher/SOUL.md` (line 8: `Endowment: 1 USDC`). Make sure the Proposer wallet has sufficient USDC.

### Use different wallets

1. Generate new wallets (e.g., via `ethers.Wallet.createRandom()`)
2. Update wallet addresses in all 3 SOUL.md files
3. Update agent IDs in `skills/identity-8004/scripts/lookup-agent.js`
4. Fund the new Proposer wallet with ETH + USDC on Base Sepolia

## 9. Architecture Notes

### Why a relay daemon?

Telegram's Bot API has a hard platform limitation: bots cannot receive other bots' messages via `getUpdates`, regardless of privacy settings or admin status. This means the Proposer bot can't see the Researcher's announcement, and the Responder can't see the Proposer's proposal.

The relay daemon bridges this gap by:
1. Polling each agent's session JSONL files (written by OpenClaw after each turn)
2. Pattern-matching on message content to determine routing
3. Triggering the next agent via `openclaw agent --message "..." --deliver`
4. Adding sender context so each agent knows who the message is from

### Grade buffering

Without buffering, the Researcher would receive grades one at a time and post partial updates. The relay daemon collects both grades (with a 15-second timeout) and sends them as a single combined message to the Researcher.

### Session management

Each agent's conversation history lives in JSONL files under `~/.openclaw/agents/{id}/sessions/`. The relay daemon tracks the last-read line count per file and resets when a new session file appears. Clearing these files (`rm *.jsonl`) gives you a fresh start.
