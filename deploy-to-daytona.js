#!/usr/bin/env node
/**
 * Behaive Arena — One-command deploy to Daytona Sandbox
 *
 * Usage: node deploy-to-daytona.js
 *
 * This script:
 * 1. Creates a Daytona sandbox
 * 2. Uploads all config, skills, and SOUL.md files
 * 3. Installs OpenClaw + ethers.js
 * 4. Configures the 3-agent gateway
 * 5. Starts the OpenClaw gateway
 *
 * Prerequisites: Node.js 18+, internet connection
 */

const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIG — loaded from .env in same directory
// ============================================================
const envPath = path.join(__dirname, ".env");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env file not found. Copy .env.example to .env and fill in credentials.");
  process.exit(1);
}
const envContent = fs.readFileSync(envPath, "utf8");
const ENV = {};
envContent.split("\n").forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) return;
  ENV[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
});

const DAYTONA_KEY = ENV.DAYTONA_API_KEY;
const DAYTONA_URL = ENV.DAYTONA_API_URL || "https://app.daytona.io/api";
const PROXY_URL = "https://proxy.app.daytona.io/toolbox";

if (!DAYTONA_KEY) {
  console.error("❌ DAYTONA_API_KEY not found in .env");
  process.exit(1);
}

const HEADERS = {
  "Authorization": `Bearer ${DAYTONA_KEY}`,
  "Content-Type": "application/json"
};

// ============================================================
// API HELPERS
// ============================================================
async function apiCall(url, options = {}) {
  const resp = await fetch(url, { ...options, headers: { ...HEADERS, ...options.headers } });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`API ${resp.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function execInSandbox(sandboxId, command, timeout = 120000) {
  console.log(`   ⏳ Running: ${command.slice(0, 80)}${command.length > 80 ? "..." : ""}`);
  const result = await apiCall(`${PROXY_URL}/${sandboxId}/process/exec`, {
    method: "POST",
    body: JSON.stringify({ command, timeout })
  });
  if (result && result.exitCode !== 0) {
    console.log(`   ⚠️  Exit code ${result.exitCode}: ${(result.result || "").slice(0, 200)}`);
  }
  return result;
}

async function uploadFile(sandboxId, filePath, content) {
  const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${path.basename(filePath)}"`,
    "Content-Type: application/octet-stream",
    "",
    content,
    `--${boundary}--`
  ].join("\r\n");

  const resp = await fetch(
    `${PROXY_URL}/${sandboxId}/files/upload?path=${encodeURIComponent(filePath)}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DAYTONA_KEY}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`
      },
      body
    }
  );
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Upload failed for ${filePath}: ${resp.status} ${txt}`);
  }
}

async function writeFile(sandboxId, filePath, content) {
  // Use exec to write file content (more reliable for text files)
  const escaped = content.replace(/'/g, "'\\''");
  await execInSandbox(sandboxId, `mkdir -p "$(dirname '${filePath}')" && cat > '${filePath}' << 'ENDOFFILE'\n${content}\nENDOFFILE`);
}

// ============================================================
// MAIN DEPLOY
// ============================================================
async function main() {
  console.log("🦞 Behaive Arena — Deploying to Daytona");
  console.log("========================================\n");

  // --- Step 1: Create sandbox ---
  console.log("📦 Step 1: Creating Daytona sandbox...");
  const sandbox = await apiCall(`${DAYTONA_URL}/sandboxes`, {
    method: "POST",
    body: JSON.stringify({
      language: "javascript",
      envVars: {
        ANTHROPIC_API_KEY: ENV.ANTHROPIC_API_KEY,
        TG_RESEARCHER_TOKEN: ENV.TG_RESEARCHER_TOKEN,
        TG_PROPOSER_TOKEN: ENV.TG_PROPOSER_TOKEN,
        TG_RESPONDER_TOKEN: ENV.TG_RESPONDER_TOKEN,
        BASE_SEPOLIA_RPC: ENV.BASE_SEPOLIA_RPC,
        USDC_CONTRACT: ENV.USDC_CONTRACT,
        RESEARCHER_PRIVATE_KEY: ENV.RESEARCHER_PRIVATE_KEY,
        PROPOSER_PRIVATE_KEY: ENV.PROPOSER_PRIVATE_KEY,
        RESPONDER_PRIVATE_KEY: ENV.RESPONDER_PRIVATE_KEY,
        RESEARCHER_ADDRESS: ENV.RESEARCHER_ADDRESS,
        PROPOSER_ADDRESS: ENV.PROPOSER_ADDRESS,
        RESPONDER_ADDRESS: ENV.RESPONDER_ADDRESS
      },
      resources: { cpu: 2, memory: 4 },
      autoStopInterval: 0
    })
  });

  const sandboxId = sandbox.id;
  console.log(`✅ Sandbox created: ${sandboxId}\n`);

  // Wait for sandbox to be ready
  console.log("⏳ Waiting for sandbox to be ready...");
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const status = await apiCall(`${DAYTONA_URL}/sandboxes/${sandboxId}`);
      if (status.state === "running" || status.state === "started") {
        ready = true;
        break;
      }
      console.log(`   State: ${status.state}...`);
    } catch (e) { /* retry */ }
    await new Promise(r => setTimeout(r, 3000));
  }
  if (!ready) {
    console.error("❌ Sandbox failed to start. Check Daytona dashboard.");
    process.exit(1);
  }
  console.log("✅ Sandbox is running\n");

  // --- Step 2: Install OpenClaw ---
  console.log("🦞 Step 2: Installing OpenClaw...");
  await execInSandbox(sandboxId, "npm install -g openclaw", 180000);
  const version = await execInSandbox(sandboxId, "openclaw --version");
  console.log(`✅ OpenClaw installed: ${(version?.result || "").trim()}\n`);

  // --- Step 3: Create directory structure ---
  console.log("📁 Step 3: Creating directories...");
  await execInSandbox(sandboxId, [
    "mkdir -p ~/.openclaw/workspace-researcher",
    "mkdir -p ~/.openclaw/workspace-proposer",
    "mkdir -p ~/.openclaw/workspace-responder",
    "mkdir -p ~/.openclaw/skills/wallet-ops/scripts",
    "mkdir -p ~/.openclaw/skills/identity-8004/scripts",
    "mkdir -p ~/.openclaw/skills/reputation/scripts"
  ].join(" && "));
  console.log("✅ Directories created\n");

  // --- Step 4: Upload all files ---
  console.log("📤 Step 4: Uploading configuration files...");

  const filesToUpload = [
    { remote: "/root/.openclaw/openclaw.json", local: "config/openclaw.json" },
    { remote: "/root/.openclaw/workspace-researcher/SOUL.md", local: "agents/researcher/SOUL.md" },
    { remote: "/root/.openclaw/workspace-proposer/SOUL.md", local: "agents/proposer/SOUL.md" },
    { remote: "/root/.openclaw/workspace-responder/SOUL.md", local: "agents/responder/SOUL.md" },
    { remote: "/root/.openclaw/skills/wallet-ops/SKILL.md", local: "skills/wallet-ops/SKILL.md" },
    { remote: "/root/.openclaw/skills/wallet-ops/scripts/check-balance.js", local: "skills/wallet-ops/scripts/check-balance.js" },
    { remote: "/root/.openclaw/skills/wallet-ops/scripts/check-eth.js", local: "skills/wallet-ops/scripts/check-eth.js" },
    { remote: "/root/.openclaw/skills/wallet-ops/scripts/send-usdc.js", local: "skills/wallet-ops/scripts/send-usdc.js" },
    { remote: "/root/.openclaw/skills/identity-8004/SKILL.md", local: "skills/identity-8004/SKILL.md" },
    { remote: "/root/.openclaw/skills/identity-8004/scripts/lookup-agent.js", local: "skills/identity-8004/scripts/lookup-agent.js" },
    { remote: "/root/.openclaw/skills/reputation/SKILL.md", local: "skills/reputation/SKILL.md" },
    { remote: "/root/.openclaw/skills/reputation/scripts/grade.js", local: "skills/reputation/scripts/grade.js" },
    { remote: "/root/.openclaw/skills/reputation/scripts/get-reputation.js", local: "skills/reputation/scripts/get-reputation.js" }
  ];

  for (const f of filesToUpload) {
    const content = fs.readFileSync(path.join(__dirname, f.local), "utf8");
    await writeFile(sandboxId, f.remote, content);
    console.log(`   ✅ ${f.remote}`);
  }
  console.log("");

  // --- Step 5: Install ethers.js ---
  console.log("📦 Step 5: Installing ethers.js for blockchain skills...");
  await execInSandbox(sandboxId, "cd ~/.openclaw/skills && npm init -y && npm install ethers@6", 120000);
  console.log("✅ ethers.js installed\n");

  // --- Step 6: Verify wallet balances ---
  console.log("💰 Step 6: Checking wallet balances...");
  const wallets = [
    { name: "Researcher", addr: ENV.RESEARCHER_ADDRESS },
    { name: "Proposer", addr: ENV.PROPOSER_ADDRESS },
    { name: "Responder", addr: ENV.RESPONDER_ADDRESS }
  ];
  for (const w of wallets) {
    const result = await execInSandbox(sandboxId,
      `NODE_PATH=~/.openclaw/skills/node_modules node ~/.openclaw/skills/wallet-ops/scripts/check-balance.js ${w.addr}`
    );
    console.log(`   ${w.name}: ${(result?.result || "check failed").trim()}`);
  }
  console.log("");

  // --- Step 7: Start OpenClaw gateway ---
  console.log("🚀 Step 7: Starting OpenClaw Gateway...");
  console.log("   This connects all 3 bots to Telegram.\n");

  // Start gateway in background
  await execInSandbox(sandboxId,
    "nohup openclaw gateway start > /tmp/openclaw-gateway.log 2>&1 &"
  );

  // Wait a moment and check
  await new Promise(r => setTimeout(r, 5000));
  const logs = await execInSandbox(sandboxId, "cat /tmp/openclaw-gateway.log 2>/dev/null || echo 'Starting...'");
  console.log(`   Gateway logs: ${(logs?.result || "").trim().slice(0, 500)}`);

  console.log("\n========================================");
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("========================================\n");
  console.log(`Sandbox ID: ${sandboxId}`);
  console.log(`Daytona Dashboard: https://app.daytona.io`);
  console.log("");
  console.log("Now go to your Telegram group and type:");
  console.log("  @ResearcherBot start game");
  console.log("");
  console.log("For multiple rounds:");
  console.log("  @ResearcherBot start game 3 rounds");
  console.log("");
  console.log("To check gateway logs:");
  console.log(`  Use Daytona dashboard or API to exec: cat /tmp/openclaw-gateway.log`);
  console.log("");
  console.log("To stop the sandbox later:");
  console.log(`  curl -X POST "${DAYTONA_URL}/sandboxes/${sandboxId}/stop" -H "Authorization: Bearer ${DAYTONA_KEY}"`);
}

main().catch(err => {
  console.error("❌ Deployment failed:", err.message);
  process.exit(1);
});
