#!/usr/bin/env bash
# ============================================================================
# Behaive v2 — Setup Script
# Deploys the OpenClaw Ultimatum Game to a Daytona sandbox (or any Ubuntu box)
# ============================================================================
set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# --- Determine project root (where this script lives) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_HOME="${HOME}/.openclaw"

echo ""
echo "============================================"
echo "  Behaive v2 — Ultimatum Game Setup"
echo "============================================"
echo ""

# ============================================================================
# STEP 0: Pre-flight checks
# ============================================================================
info "Checking prerequisites..."

command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install Node.js 18+ first."
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  fail "Node.js 18+ required, found $(node -v)"
fi
ok "Node.js $(node -v)"

command -v npm >/dev/null 2>&1 || fail "npm is not installed."
ok "npm $(npm -v)"

# ============================================================================
# STEP 1: Collect configuration
# ============================================================================
echo ""
info "=== Configuration ==="
echo ""
echo "You'll need the following before proceeding:"
echo "  1. Three Telegram bot tokens (from @BotFather)"
echo "  2. Telegram group chat ID (negative number)"
echo "  3. Anthropic API key"
echo "  4. Proposer wallet private key (for USDC transfers)"
echo "  5. (Optional) Webhook URL for web UI"
echo ""

# Check if config already exists
if [ -f "${OPENCLAW_HOME}/openclaw.json" ]; then
  warn "Existing config found at ${OPENCLAW_HOME}/openclaw.json"
  read -rp "Overwrite? (y/N): " OVERWRITE
  if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
    info "Keeping existing config."
    SKIP_CONFIG=true
  else
    SKIP_CONFIG=false
  fi
else
  SKIP_CONFIG=false
fi

if [ "$SKIP_CONFIG" = false ]; then
  read -rp "Researcher bot token: " RESEARCHER_TOKEN
  read -rp "Proposer bot token:   " PROPOSER_TOKEN
  read -rp "Responder bot token:  " RESPONDER_TOKEN
  read -rp "Telegram group ID:    " GROUP_ID
  read -rp "Gateway auth token (press Enter to auto-generate): " GATEWAY_TOKEN

  if [ -z "$GATEWAY_TOKEN" ]; then
    GATEWAY_TOKEN=$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | xxd -p | tr -d '\n' | head -c 48)
    info "Generated gateway token: ${GATEWAY_TOKEN}"
  fi
fi

read -rp "Proposer private key (for USDC transfers): " PROPOSER_PRIVATE_KEY
read -rp "Webhook URL (optional, press Enter to skip): " WEBHOOK_URL

# Anthropic API key
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  read -rp "Anthropic API key: " ANTHROPIC_API_KEY
  export ANTHROPIC_API_KEY
fi

# ============================================================================
# STEP 2: Install OpenClaw
# ============================================================================
echo ""
info "=== Installing OpenClaw ==="

if command -v openclaw >/dev/null 2>&1; then
  ok "OpenClaw already installed: $(openclaw --version 2>/dev/null || echo 'version unknown')"
else
  info "Installing OpenClaw globally..."
  npm install -g @anthropic/openclaw
  ok "OpenClaw installed"
fi

# Determine openclaw path
OPENCLAW_BIN=$(which openclaw 2>/dev/null || echo "${HOME}/.npm-global/bin/openclaw")
if [ ! -f "$OPENCLAW_BIN" ]; then
  # Try common npm global locations
  for candidate in /usr/local/bin/openclaw "${HOME}/.npm-global/bin/openclaw" "$(npm config get prefix)/bin/openclaw"; do
    if [ -f "$candidate" ]; then
      OPENCLAW_BIN="$candidate"
      break
    fi
  done
fi
info "OpenClaw binary: ${OPENCLAW_BIN}"

# ============================================================================
# STEP 3: Create directory structure
# ============================================================================
echo ""
info "=== Creating directory structure ==="

mkdir -p "${OPENCLAW_HOME}"
mkdir -p "${OPENCLAW_HOME}/workspace-researcher"
mkdir -p "${OPENCLAW_HOME}/workspace-proposer"
mkdir -p "${OPENCLAW_HOME}/workspace-responder"
mkdir -p "${OPENCLAW_HOME}/skills/personas"
mkdir -p "${OPENCLAW_HOME}/skills/wallet-ops/scripts"
mkdir -p "${OPENCLAW_HOME}/skills/reputation/scripts"
mkdir -p "${OPENCLAW_HOME}/skills/identity-8004/scripts"

ok "Directory structure created at ${OPENCLAW_HOME}"

# ============================================================================
# STEP 4: Deploy configuration
# ============================================================================
echo ""
info "=== Deploying configuration ==="

if [ "$SKIP_CONFIG" = false ]; then
  # Generate config from template
  sed \
    -e "s|YOUR_RESEARCHER_BOT_TOKEN|${RESEARCHER_TOKEN}|g" \
    -e "s|YOUR_PROPOSER_BOT_TOKEN|${PROPOSER_TOKEN}|g" \
    -e "s|YOUR_RESPONDER_BOT_TOKEN|${RESPONDER_TOKEN}|g" \
    -e "s|YOUR_TELEGRAM_GROUP_ID|${GROUP_ID}|g" \
    -e "s|YOUR_GATEWAY_AUTH_TOKEN|${GATEWAY_TOKEN}|g" \
    "${SCRIPT_DIR}/config/openclaw.example.json" > "${OPENCLAW_HOME}/openclaw.json"
  ok "Config deployed to ${OPENCLAW_HOME}/openclaw.json"
else
  ok "Using existing config"
fi

# ============================================================================
# STEP 5: Deploy SOUL.md files (agent identities)
# ============================================================================
echo ""
info "=== Deploying agent identities ==="

cp "${SCRIPT_DIR}/workspaces/researcher/SOUL.md" "${OPENCLAW_HOME}/workspace-researcher/"
cp "${SCRIPT_DIR}/workspaces/proposer/SOUL.md"   "${OPENCLAW_HOME}/workspace-proposer/"
cp "${SCRIPT_DIR}/workspaces/responder/SOUL.md"  "${OPENCLAW_HOME}/workspace-responder/"

ok "SOUL.md files deployed for all 3 agents"

# ============================================================================
# STEP 6: Deploy skills
# ============================================================================
echo ""
info "=== Deploying skills ==="

# Personas
cp "${SCRIPT_DIR}/skills/personas/"*.md "${OPENCLAW_HOME}/skills/personas/"
ok "5 persona files deployed"

# Wallet-ops
cp "${SCRIPT_DIR}/skills/wallet-ops/SKILL.md" "${OPENCLAW_HOME}/skills/wallet-ops/"
cp "${SCRIPT_DIR}/skills/wallet-ops/scripts/"*.js "${OPENCLAW_HOME}/skills/wallet-ops/scripts/"
ok "wallet-ops skill deployed"

# Reputation
cp "${SCRIPT_DIR}/skills/reputation/SKILL.md" "${OPENCLAW_HOME}/skills/reputation/"
cp "${SCRIPT_DIR}/skills/reputation/scripts/"*.js "${OPENCLAW_HOME}/skills/reputation/scripts/"
ok "reputation skill deployed"

# Identity
cp "${SCRIPT_DIR}/skills/identity-8004/SKILL.md" "${OPENCLAW_HOME}/skills/identity-8004/"
cp "${SCRIPT_DIR}/skills/identity-8004/scripts/"*.js "${OPENCLAW_HOME}/skills/identity-8004/scripts/"
ok "identity-8004 skill deployed"

# Package.json and install deps
cp "${SCRIPT_DIR}/skills/package.json" "${OPENCLAW_HOME}/skills/"
info "Installing skill dependencies (ethers.js)..."
cd "${OPENCLAW_HOME}/skills" && npm install --production 2>&1 | tail -3
ok "Skill dependencies installed"

# ============================================================================
# STEP 7: Deploy relay daemon
# ============================================================================
echo ""
info "=== Deploying relay daemon ==="

cp "${SCRIPT_DIR}/relay-daemon.js" "${HOME}/relay-daemon.js"
ok "Relay daemon deployed (group ID and webhook come from env)"

# ============================================================================
# STEP 8: Set environment variables
# ============================================================================
echo ""
info "=== Setting environment variables ==="

# Write env file for easy sourcing (relay reads TELEGRAM_GROUP_ID and WEBHOOK_URL from env)
ENV_FILE="${HOME}/.behaive-env"
cat > "$ENV_FILE" << ENVEOF
# Behaive v2 — Environment Variables
# Source this file: source ~/.behaive-env

export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"
export PROPOSER_PRIVATE_KEY="${PROPOSER_PRIVATE_KEY}"
export TELEGRAM_GROUP_ID="${GROUP_ID}"
ENVEOF

if [ -n "${WEBHOOK_URL:-}" ]; then
  echo "export WEBHOOK_URL=\"${WEBHOOK_URL}\"" >> "$ENV_FILE"
fi

chmod 600 "$ENV_FILE"
source "$ENV_FILE"
ok "Environment saved to ${ENV_FILE} (source ~/.behaive-env)"

# ============================================================================
# STEP 9: Start services
# ============================================================================
echo ""
info "=== Starting services ==="

# Kill any existing instances
pkill -f "openclaw gateway" 2>/dev/null && warn "Killed existing gateway" || true
pkill -f "relay-daemon" 2>/dev/null && warn "Killed existing relay" || true
sleep 2

# Clear any stale sessions
for agent in researcher proposer responder; do
  SESS_DIR="${OPENCLAW_HOME}/agents/${agent}/sessions"
  if [ -d "$SESS_DIR" ]; then
    rm -f "${SESS_DIR}"/*.jsonl 2>/dev/null
    info "Cleared sessions for ${agent}"
  fi
done

# Start gateway
info "Starting OpenClaw gateway..."
nohup "$OPENCLAW_BIN" gateway > "${HOME}/gateway.log" 2>&1 &
GATEWAY_PID=$!
sleep 3

if kill -0 "$GATEWAY_PID" 2>/dev/null; then
  ok "Gateway started (PID: ${GATEWAY_PID})"
  tail -3 "${HOME}/gateway.log" 2>/dev/null || true
else
  fail "Gateway failed to start. Check ${HOME}/gateway.log"
fi

# Start relay daemon
info "Starting relay daemon..."
nohup node "${HOME}/relay-daemon.js" > "${HOME}/relay.log" 2>&1 &
RELAY_PID=$!
sleep 2

if kill -0 "$RELAY_PID" 2>/dev/null; then
  ok "Relay daemon started (PID: ${RELAY_PID})"
  tail -5 "${HOME}/relay.log" 2>/dev/null || true
else
  fail "Relay daemon failed to start. Check ${HOME}/relay.log"
fi

# ============================================================================
# DONE
# ============================================================================
echo ""
echo "============================================"
echo -e "  ${GREEN}Setup complete!${NC}"
echo "============================================"
echo ""
echo "  Gateway PID:  ${GATEWAY_PID}"
echo "  Relay PID:    ${RELAY_PID}"
echo "  Gateway log:  ${HOME}/gateway.log"
echo "  Relay log:    ${HOME}/relay.log"
echo "  Env file:     ${HOME}/.behaive-env"
echo ""
echo "  To trigger a game, send in your Telegram group:"
echo "    @researcher_bot start game proposer=shark responder=fair"
echo ""
echo "  Useful commands:"
echo "    tail -f ~/relay.log          # Watch relay messages"
echo "    tail -f ~/gateway.log        # Watch gateway"
echo "    source ~/.behaive-env        # Reload env vars"
echo ""
echo "  To restart services:"
echo "    pkill -f 'openclaw gateway'; nohup openclaw gateway > ~/gateway.log 2>&1 &"
echo "    pkill -f relay-daemon; nohup node ~/relay-daemon.js > ~/relay.log 2>&1 &"
echo ""
