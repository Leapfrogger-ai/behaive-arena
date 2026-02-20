#!/bin/bash
set -e

echo "🦞 Behaive Arena — OpenClaw 3-Agent Setup"
echo "==========================================="
echo ""

# --- 1. Check prerequisites ---
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install Node.js 22+ first: https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 22 ]; then
  echo "❌ Node.js $NODE_VER found, need 22+. Please upgrade."
  exit 1
fi
echo "✅ Node.js $(node -v)"

if ! command -v npm &> /dev/null; then
  echo "❌ npm not found"
  exit 1
fi
echo "✅ npm $(npm -v)"

# --- 2. Load environment ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  echo "📦 Loading .env..."
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
  echo "✅ Environment loaded"
else
  echo "❌ .env file not found in $SCRIPT_DIR"
  echo "   Copy .env.example to .env and fill in your credentials"
  exit 1
fi

# --- 3. Install OpenClaw ---
echo ""
echo "🦞 Installing OpenClaw..."
if ! command -v openclaw &> /dev/null; then
  npm install -g openclaw
  echo "✅ OpenClaw installed"
else
  echo "✅ OpenClaw already installed ($(openclaw --version))"
fi

# --- 4. Create directory structure ---
echo ""
echo "📁 Setting up OpenClaw directories..."
OCDIR="$HOME/.openclaw"
mkdir -p "$OCDIR/workspace-researcher"
mkdir -p "$OCDIR/workspace-proposer"
mkdir -p "$OCDIR/workspace-responder"
mkdir -p "$OCDIR/skills/wallet-ops/scripts"
mkdir -p "$OCDIR/skills/identity-8004/scripts"
mkdir -p "$OCDIR/skills/reputation/scripts"

# --- 5. Copy configuration ---
echo "⚙️  Writing OpenClaw config..."
cp "$SCRIPT_DIR/config/openclaw.json" "$OCDIR/openclaw.json"
chmod 600 "$OCDIR/openclaw.json"

# --- 6. Copy SOUL.md files ---
echo "🧠 Writing SOUL.md personas..."
cp "$SCRIPT_DIR/agents/researcher/SOUL.md" "$OCDIR/workspace-researcher/SOUL.md"
cp "$SCRIPT_DIR/agents/proposer/SOUL.md" "$OCDIR/workspace-proposer/SOUL.md"
cp "$SCRIPT_DIR/agents/responder/SOUL.md" "$OCDIR/workspace-responder/SOUL.md"

# --- 7. Copy skills ---
echo "🔧 Installing skills..."
cp "$SCRIPT_DIR/skills/wallet-ops/SKILL.md" "$OCDIR/skills/wallet-ops/SKILL.md"
cp "$SCRIPT_DIR/skills/wallet-ops/scripts/"*.js "$OCDIR/skills/wallet-ops/scripts/"
cp "$SCRIPT_DIR/skills/identity-8004/SKILL.md" "$OCDIR/skills/identity-8004/SKILL.md"
cp "$SCRIPT_DIR/skills/identity-8004/scripts/"*.js "$OCDIR/skills/identity-8004/scripts/"
cp "$SCRIPT_DIR/skills/reputation/SKILL.md" "$OCDIR/skills/reputation/SKILL.md"
cp "$SCRIPT_DIR/skills/reputation/scripts/"*.js "$OCDIR/skills/reputation/scripts/"

# Install ethers.js in skills dir
echo "📦 Installing ethers.js..."
cd "$OCDIR/skills"
if [ ! -d "node_modules/ethers" ]; then
  npm init -y > /dev/null 2>&1
  npm install ethers@6 > /dev/null 2>&1
fi
echo "✅ ethers.js installed"

# --- 8. Validate wallet balances ---
echo ""
echo "💰 Checking wallet balances..."
echo "   Researcher (0x4B72...):"
NODE_PATH="$OCDIR/skills/node_modules" node "$OCDIR/skills/wallet-ops/scripts/check-balance.js" "$RESEARCHER_ADDRESS" 2>/dev/null || echo "   ⚠️  Could not check (network issue?)"
echo "   Proposer (0xB430...):"
NODE_PATH="$OCDIR/skills/node_modules" node "$OCDIR/skills/wallet-ops/scripts/check-balance.js" "$PROPOSER_ADDRESS" 2>/dev/null || echo "   ⚠️  Could not check (network issue?)"
echo "   Responder (0x328D...):"
NODE_PATH="$OCDIR/skills/node_modules" node "$OCDIR/skills/wallet-ops/scripts/check-balance.js" "$RESPONDER_ADDRESS" 2>/dev/null || echo "   ⚠️  Could not check (network issue?)"

# --- 9. Start gateway ---
echo ""
echo "🚀 Starting OpenClaw Gateway..."
echo "   This will connect all 3 bots to Telegram."
echo "   Press Ctrl+C to stop."
echo ""

export ANTHROPIC_API_KEY
export TG_RESEARCHER_TOKEN
export TG_PROPOSER_TOKEN
export TG_RESPONDER_TOKEN
export BASE_SEPOLIA_RPC
export USDC_CONTRACT
export RESEARCHER_PRIVATE_KEY
export PROPOSER_PRIVATE_KEY
export RESPONDER_PRIVATE_KEY
export RESEARCHER_ADDRESS
export PROPOSER_ADDRESS
export RESPONDER_ADDRESS

openclaw gateway start
