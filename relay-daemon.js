#!/usr/bin/env node
/**
 * Relay Daemon v2 — Bridges bot-to-bot communication for the Ultimatum Game
 *
 * Telegram's Bot API doesn't deliver bot messages to other bots.
 * This daemon monitors agent session JSONL files and forwards
 * each agent's response to the next agent in the game chain:
 *   researcher → proposer → responder (→ researcher for round result)
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { execSync } = require("child_process");

// === Config (set via environment) ===
const OPENCLAW = process.env.OPENCLAW_PATH || "/home/daytona/.npm-global/bin/openclaw";
const AGENTS_DIR = process.env.OPENCLAW_AGENTS_DIR || "/home/daytona/.openclaw/agents";
const RAW_GROUP_ID = process.env.TELEGRAM_GROUP_ID || "";
// Restrict to numeric group ID to prevent command injection
const GROUP_ID = /^-?\d+$/.test(RAW_GROUP_ID.trim()) ? RAW_GROUP_ID.trim() : "";
const POLL_INTERVAL = 2500; // ms

// Webhook URL for UI/structured payloads (optional; no default to avoid committing endpoints)
const WEBHOOK_URL = process.env.WEBHOOK_URL || "";

// Agent metadata for webhook payloads
const AGENT_META = {
  researcher: { id: 931, role: "Game Master", wallet: "0x4B727B5947AEDb36545cCBDC16E2a81B837C0103" },
  proposer:   { id: 932, role: "Proposer",     wallet: "0xB4305A685E7370b170F5005A4efd268e3DdB2A6E" },
  responder:  { id: 933, role: "Responder",     wallet: "0x328DB42692f438Ab8D9e020Ac63ebF72508e7D34" },
};

// Current round & game tracker
let currentRound = 0;
let currentGameId = null;

function generateGameId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `UG-${ts}${rand}`;
}

function clearAgentSessions(agents) {
  for (const agentId of agents) {
    const sessDir = path.join(AGENTS_DIR, agentId, "sessions");
    try {
      const files = fs.readdirSync(sessDir).filter(f => f.endsWith(".jsonl"));
      for (const f of files) {
        fs.unlinkSync(path.join(sessDir, f));
      }
      if (files.length > 0) log(`🧹 Cleared ${files.length} session file(s) for ${agentId}`);
      // Reset tracked state so relay doesn't read stale data
      state[agentId] = { file: null, lines: 0 };
    } catch (e) { /* ignore */ }
  }
}

// Track what we've already processed: { agentId: { file: path, lines: count } }
const state = {};

// Track active relay operations to prevent duplicates
const activeRelays = new Set();

// Grade buffer — collect both grades before sending to researcher
const gradeBuffer = { proposer: null, responder: null, timer: null };

// Dedup: track message hashes we've already relayed
const relayedHashes = new Set();

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[relay ${ts}] ${msg}`);
}

function hashMsg(text) {
  // Simple hash for dedup
  let h = 0;
  for (let i = 0; i < Math.min(text.length, 200); i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

// === Webhook — structured payloads for web UI ===

// Game state tracked across the round for building rich payloads
let gameState = {
  totalRounds: 1,
  endowment: 1.0,
  proposerPersona: null,
  responderPersona: null,
  lastOffer: { proposerKeeps: 0, responderGets: 0 },
};

// --- Text parsers ---
function extractPersona(text) {
  const m = text.match(/Persona:\s*([\w\s]+?)[\s|]/i);
  return m ? m[1].trim().toLowerCase() : null;
}

function extractBalance(text, pattern) {
  // Try "12.60 USDC" near an address or agent label
  const m = text.match(pattern);
  return m ? parseFloat(m[1]) : null;
}

function extractRep(text, pattern) {
  const m = text.match(pattern);
  return m ? parseInt(m[1]) : null;
}

function extractRepGrades(text, pattern) {
  const m = text.match(pattern);
  return m ? parseInt(m[1]) : null;
}

function parseOffer(text) {
  // "I keep 0.70 USDC, @responder gets 0.30 USDC" or "0.70/0.30" or "keep 0.7" + "gets 0.3"
  let m = text.match(/keep\s+([\d.]+)\s*USDC.*?gets?\s+([\d.]+)\s*USDC/i);
  if (m) return { proposerKeeps: parseFloat(m[1]), responderGets: parseFloat(m[2]) };
  m = text.match(/PROPOSAL.*?([\d.]+)\s*\/\s*([\d.]+)/i);
  if (m) return { proposerKeeps: parseFloat(m[1]), responderGets: parseFloat(m[2]) };
  m = text.match(/keep\s+([\d.]+)/i);
  const m2 = text.match(/(?:gets?|offered?)\s+([\d.]+)/i);
  if (m && m2) return { proposerKeeps: parseFloat(m[1]), responderGets: parseFloat(m2[1]) };
  // "offered X USDC of Y"
  m = text.match(/offered?\s+([\d.]+)\s*USDC\s*(?:of|out of)\s*([\d.]+)/i);
  if (m) return { proposerKeeps: parseFloat(m[2]) - parseFloat(m[1]), responderGets: parseFloat(m[1]) };
  return null;
}

function parseGrade(text, targetLabel) {
  // "GRADE for Responder #933: 45/100. reason." or "graded Responder: 45/100"
  const patterns = [
    new RegExp(`GRADE.*?${targetLabel}.*?(\\d+)\\s*/\\s*100[.:]?\\s*(.*)`, "i"),
    new RegExp(`graded\\s+${targetLabel}.*?(\\d+)\\s*/\\s*100`, "i"),
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return { score: parseInt(m[1]), quote: (m[2] || "").trim().replace(/\n.*/s, "").slice(0, 200) };
  }
  return null;
}

function parseGameStart(text) {
  // Round N/M or ROUND N
  let totalRounds = 1;
  const rm = text.match(/ROUND\s+(\d+)\s*(?:\/\s*(\d+))?/i);
  if (rm && rm[2]) totalRounds = parseInt(rm[2]);
  gameState.totalRounds = totalRounds;

  // Endowment
  const em = text.match(/Endowment:\s*([\d.]+)\s*USDC/i);
  if (em) gameState.endowment = parseFloat(em[1]);

  // Personas
  const pp = text.match(/Proposer\s+persona:\s*\*{0,2}(\w+)\*{0,2}/i);
  const rp = text.match(/Responder\s+persona:\s*\*{0,2}(\w+)\*{0,2}/i);
  gameState.proposerPersona = pp ? pp[1].toLowerCase() : null;
  gameState.responderPersona = rp ? rp[1].toLowerCase() : null;

  // Proposer balance & rep
  const pBal = extractBalance(text, /Proposer.*?([\d.]+)\s*USDC/i);
  const pRep = extractRep(text, /Proposer.*?Rep:\s*([\d]+)/i);
  const pRepG = extractRepGrades(text, /Proposer.*?Rep:.*?\((\d+)\s*grade/i);

  // Responder balance & rep
  const rBal = extractBalance(text, /Responder.*?([\d.]+)\s*USDC/i);
  const rRep = extractRep(text, /Responder.*?Rep:\s*([\d]+)/i);
  const rRepG = extractRepGrades(text, /Responder.*?Rep:.*?\((\d+)\s*grade/i);

  return {
    agent: "researcher",
    agentId: 931,
    role: "Game Master",
    wallet: AGENT_META.researcher.wallet,
    text: text,
    gameEvent: "game_start",
    gameType: "ultimatum",
    round: currentRound,
    totalRounds: gameState.totalRounds,
    endowment: gameState.endowment,
    currency: "USDC",
    proposer: {
      username: "proposer26_bot",
      agentId: 932,
      persona: gameState.proposerPersona,
      wallet: AGENT_META.proposer.wallet,
      balance: pBal,
      reputation: pRep,
      reputationGrades: pRepG,
    },
    responder: {
      username: "responder26_bot",
      agentId: 933,
      persona: gameState.responderPersona,
      wallet: AGENT_META.responder.wallet,
      balance: rBal,
      reputation: rRep,
      reputationGrades: rRepG,
    },
    timestamp: new Date().toISOString(),
  };
}

function parseOfferPayload(text) {
  const offer = parseOffer(text);
  if (offer) gameState.lastOffer = offer;
  return {
    agent: "proposer",
    agentId: 932,
    role: "Proposer",
    wallet: AGENT_META.proposer.wallet,
    text: text,
    persona: extractPersona(text) || gameState.proposerPersona,
    gameEvent: "offer",
    gameType: "ultimatum",
    round: currentRound,
    offer: offer || gameState.lastOffer,
    timestamp: new Date().toISOString(),
  };
}

function parseResponsePayload(text) {
  const accepted = isAcceptance(text);
  // Try to parse offer amounts from responder text ("offered 0.30 USDC of 1.00")
  const offer = parseOffer(text) || gameState.lastOffer;
  return {
    agent: "responder",
    agentId: 933,
    role: "Responder",
    wallet: AGENT_META.responder.wallet,
    text: text,
    persona: extractPersona(text) || gameState.responderPersona,
    gameEvent: "response",
    gameType: "ultimatum",
    round: currentRound,
    offer: {
      proposerKeeps: offer.proposerKeeps,
      responderGets: offer.responderGets,
      accepted: accepted,
    },
    timestamp: new Date().toISOString(),
  };
}

function parseVerdictPayload(text) {
  const accepted = text.toUpperCase().includes("ACCEPTED");
  const offer = parseOffer(text) || gameState.lastOffer;

  // Parse grades: "Proposer(shark) graded Responder: 45/100 | Responder(fair) graded Proposer: 70/100"
  const pGrade = parseGrade(text, "Responder");  // proposer's grade OF responder
  const rGrade = parseGrade(text, "Proposer");    // responder's grade OF proposer

  return {
    agent: "researcher",
    agentId: 931,
    role: "Game Master",
    wallet: AGENT_META.researcher.wallet,
    text: text,
    gameEvent: "verdict",
    gameType: "ultimatum",
    round: currentRound,
    verdict: {
      accepted: accepted,
      proposerScore: rGrade ? rGrade.score : null,    // score proposer received
      responderScore: pGrade ? pGrade.score : null,    // score responder received
      proposerQuote: rGrade ? rGrade.quote : null,
      responderQuote: pGrade ? pGrade.quote : null,
    },
    offer: {
      proposerKeeps: offer.proposerKeeps,
      responderGets: offer.responderGets,
    },
    timestamp: new Date().toISOString(),
  };
}

function parseChatPayload(agentId, text) {
  const meta = AGENT_META[agentId] || { id: 0, role: agentId, wallet: "" };
  return {
    agent: agentId,
    agentId: meta.id,
    role: meta.role,
    text: text,
    gameEvent: "chat",
    round: currentRound,
    timestamp: new Date().toISOString(),
  };
}

// --- Event classifier ---
function classifyEvent(agentId, text) {
  const t = text.toUpperCase();
  if (agentId === "researcher" && t.includes("ULTIMATUM GAME")) return "game_start";
  if (agentId === "researcher" && (t.includes("ROUND COMPLETE") || t.includes("VERDICT"))) return "verdict";
  if (agentId === "proposer" && (t.includes("PROPOSAL") || t.includes("I KEEP"))) return "offer";
  if (agentId === "responder" && (t.includes("ACCEPTED") || t.includes("REJECTED") || t.includes("ACCEPT") || t.includes("REJECT"))) return "response";
  return "chat";
}

// --- Build payload based on event type ---
function buildWebhookPayload(agentId, text, eventOverride) {
  const event = eventOverride || classifyEvent(agentId, text);
  let payload;
  switch (event) {
    case "game_start": payload = parseGameStart(text); break;
    case "offer":      payload = parseOfferPayload(text); break;
    case "response":   payload = parseResponsePayload(text); break;
    case "verdict":    payload = parseVerdictPayload(text); break;
    default:           payload = parseChatPayload(agentId, text); break;
  }
  // Attach game ID to every payload
  if (currentGameId) payload.gameId = currentGameId;
  return payload;
}

// --- Fire-and-forget HTTP POST ---
function webhookPost(agentId, text, gameEvent) {
  if (!WEBHOOK_URL) return;
  const payload = JSON.stringify(buildWebhookPayload(agentId, text, gameEvent));

  try {
    const url = new URL(WEBHOOK_URL);
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      timeout: 5000,
    }, (res) => {
      res.resume();
      const evt = gameEvent || classifyEvent(agentId, text);
      log(`🌐 Webhook ${res.statusCode} → ${agentId}/${evt}`);
    });
    req.on("error", (e) => log(`🌐 Webhook error (non-blocking): ${e.message}`));
    req.on("timeout", () => { req.destroy(); log(`🌐 Webhook timeout (non-blocking)`); });
    req.write(payload);
    req.end();
  } catch (e) {
    log(`🌐 Webhook failed (non-blocking): ${e.message}`);
  }
}

function getLatestSessionFile(agentId) {
  const sessDir = path.join(AGENTS_DIR, agentId, "sessions");
  try {
    const files = fs.readdirSync(sessDir)
      .filter(f => f.endsWith(".jsonl"))
      .map(f => ({
        name: f,
        path: path.join(sessDir, f),
        mtime: fs.statSync(path.join(sessDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return files.length > 0 ? files[0] : null;
  } catch (e) {
    return null;
  }
}

function readNewAssistantMessages(agentId) {
  const fileInfo = getLatestSessionFile(agentId);
  if (!fileInfo) return [];

  const agentState = state[agentId] || { file: null, lines: 0 };

  // If the file changed, reset the counter
  if (agentState.file !== fileInfo.path) {
    log(`📂 ${agentId}: new session file detected: ${fileInfo.name}`);
    agentState.file = fileInfo.path;
    agentState.lines = 0;
    state[agentId] = agentState;
  }

  try {
    const content = fs.readFileSync(fileInfo.path, "utf8").trim();
    if (!content) return [];

    const lines = content.split("\n");
    const startFrom = agentState.lines;

    if (lines.length <= startFrom) return [];

    const newLines = lines.slice(startFrom);
    agentState.lines = lines.length;
    state[agentId] = agentState;

    const messages = [];
    for (const line of newLines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === "message" && obj.message?.role === "assistant") {
          const content = obj.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text" && block.text && block.text.trim()) {
                messages.push(block.text.trim());
              }
            }
          } else if (typeof content === "string" && content.trim()) {
            messages.push(content.trim());
          }
        }
      } catch (e) {
        // Skip malformed lines
      }
    }
    return messages;
  } catch (e) {
    return [];
  }
}

function triggerAgent(agentId, message, replyAccount, fromAgent) {
  const msgHash = hashMsg(message);
  const dedupeKey = `${agentId}:${msgHash}`;

  if (relayedHashes.has(dedupeKey)) {
    log(`⏭ Skipping ${agentId} — already relayed this message`);
    return;
  }

  if (activeRelays.has(agentId)) {
    log(`⏳ Queuing ${agentId} relay — already active`);
    // Queue for later
    setTimeout(() => triggerAgent(agentId, message, replyAccount, fromAgent), 5000);
    return;
  }

  activeRelays.add(agentId);
  relayedHashes.add(dedupeKey);

  log(`🔄 Relaying ${fromAgent} → ${agentId} via openclaw agent...`);

  try {
    // Add sender context so the receiving agent knows who sent it
    const senderMap = {
      researcher: "@researcher_123098_bot (the Researcher/Game Master)",
      proposer: "@proposer26_bot (the Proposer)",
      responder: "@responder26_bot (the Responder)",
    };
    const senderLabel = senderMap[fromAgent] || fromAgent;

    // Extract persona hint from message if present
    let personaHint = "";
    const personaMatch = message.match(/persona:\s*(rational|fair|egalitarian|shark|punisher)/i);
    if (personaMatch) {
      personaHint = `\nYour assigned persona for this round: "${personaMatch[1].toLowerCase()}". Read the persona file and stay in character.`;
    }

    let msg = `[Message from ${senderLabel} in the Ultimatum Game group. Respond in your role.${personaHint}]\n\n${message}`;

    if (msg.length > 3500) {
      msg = msg.substring(0, 3500) + "\n[message truncated]";
    }

    // Write message to temp file to avoid shell escaping issues
    const tmpFile = `/tmp/relay-msg-${agentId}-${Date.now()}.txt`;
    fs.writeFileSync(tmpFile, msg);

    const cmd = `${OPENCLAW} agent --agent ${agentId} --message "$(cat ${tmpFile})" --deliver --reply-channel telegram --reply-to "${GROUP_ID}" --reply-account ${replyAccount} --timeout 120 --json`;

    const result = execSync(cmd, {
      timeout: 130000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: "/bin/bash",
    });

    // Clean up temp file
    try { fs.unlinkSync(tmpFile); } catch(e) {}

    // Parse result and send to webhook
    try {
      const parsed = JSON.parse(result);
      const text = parsed?.result?.payloads?.[0]?.text || "no text";
      log(`✅ ${agentId} responded: ${text.substring(0, 150)}...`);
      // Fire webhook with the agent's actual response
      if (text !== "no text") webhookPost(agentId, text);
    } catch (e) {
      log(`✅ ${agentId} responded (raw): ${result.substring(0, 150)}...`);
    }
  } catch (e) {
    log(`❌ ${agentId} relay failed: ${e.message?.substring(0, 300)}`);
    // Remove from dedup so it can be retried
    relayedHashes.delete(dedupeKey);
  } finally {
    activeRelays.delete(agentId);
  }
}

// === Message pattern matching ===
function shouldRelayToProposer(text) {
  // ONLY the game start announcement — researcher telling proposer to propose
  // Must contain the game announcement marker AND the proposer tag
  // Exclude: RESULT messages, grade requests, round summaries
  const upper = text.toUpperCase();
  if (upper.includes("RESULT:") || upper.includes("ROUND COMPLETE") || upper.includes("GRADE")) return false;
  return (
    text.includes("@proposer26_bot") &&
    (upper.includes("ULTIMATUM GAME") || upper.includes("PROPOSE YOUR SPLIT") || upper.includes("YOU'RE UP"))
  );
}

function shouldRelayToResponder(text) {
  // ONLY the proposer's proposal — must contain PROPOSAL keyword
  // Exclude: grade requests, result messages
  const upper = text.toUpperCase();
  if (upper.includes("RESULT:") || upper.includes("ROUND COMPLETE") || upper.includes("GRADE")) return false;
  return (
    text.includes("@responder26_bot") &&
    (upper.includes("PROPOSAL") || upper.includes("I KEEP"))
  );
}

function isAcceptance(text) {
  const t = text.toUpperCase();
  return t.includes("ACCEPTED") || t.includes("ACCEPT") || (text.includes("✅") && t.includes("ACCEPT"));
}

function isRejection(text) {
  const t = text.toUpperCase();
  return t.includes("REJECTED") || t.includes("REJECT") || (text.includes("❌") && t.includes("REJECT"));
}

function isDecision(text) {
  return isAcceptance(text) || isRejection(text);
}

function isGradeRequest(text) {
  return text.includes("grade") || text.includes("GRADE") || text.includes("reputation");
}

function isGradeResponse(text) {
  return text.includes("GRADE") && text.includes("/100");
}

// === Grade buffering — send both grades to researcher at once ===
function bufferGrade(agentId, msg) {
  gradeBuffer[agentId] = msg;

  // If both grades are in, flush immediately
  if (gradeBuffer.proposer && gradeBuffer.responder) {
    if (gradeBuffer.timer) clearTimeout(gradeBuffer.timer);
    flushGrades();
    return;
  }

  // Otherwise wait up to 15s for the other grade before flushing what we have
  if (!gradeBuffer.timer) {
    gradeBuffer.timer = setTimeout(() => {
      log(`⏰ Grade timeout — flushing with what we have`);
      flushGrades();
    }, 15000);
  }
}

function flushGrades() {
  if (gradeBuffer.timer) { clearTimeout(gradeBuffer.timer); gradeBuffer.timer = null; }

  const parts = [];
  if (gradeBuffer.proposer) parts.push(`Proposer's grade:\n${gradeBuffer.proposer}`);
  if (gradeBuffer.responder) parts.push(`Responder's grade:\n${gradeBuffer.responder}`);

  if (parts.length === 0) return;

  const combined = parts.join("\n\n");
  log(`📨 Sending ${parts.length} grade(s) to Researcher`);
  triggerAgent("researcher", combined, "researcher", "proposer");

  // Reset buffer
  gradeBuffer.proposer = null;
  gradeBuffer.responder = null;
}

// === Main polling loop ===
function poll() {
  // 1. Researcher → Proposer (game start or grade request)
  const researcherMsgs = readNewAssistantMessages("researcher");
  for (const msg of researcherMsgs) {
    if (msg === "NO_REPLY" || msg === "HEARTBEAT_OK" || msg.length < 15) continue;

    // Webhook: researcher messages triggered by human (via gateway, not triggerAgent)
    const upper = msg.toUpperCase();
    if (upper.includes("ULTIMATUM GAME")) {
      // New game — generate ID, clear stale sessions, reset state
      currentGameId = generateGameId();
      currentRound++;
      log(`🎮 New game ${currentGameId} — round ${currentRound}`);
      clearAgentSessions(["proposer", "responder"]);
      // Clear dedup hashes so fresh messages aren't skipped
      relayedHashes.clear();
      webhookPost("researcher", msg, "game_start");
    } else if (upper.includes("ROUND COMPLETE")) {
      webhookPost("researcher", msg, "verdict");
    }

    // Mutually exclusive routing: game start OR grade request, never both
    if (shouldRelayToProposer(msg)) {
      log(`📨 Researcher → Proposer: game start`);
      setTimeout(() => triggerAgent("proposer", msg, "proposer", "researcher"), 1500);
    } else if (isGradeRequest(msg)) {
      // Grade request — relay to whichever agents are mentioned
      if (msg.includes("@proposer26_bot")) {
        log(`📨 Researcher → Proposer: grade request`);
        setTimeout(() => triggerAgent("proposer", msg, "proposer", "researcher"), 1500);
      }
      if (msg.includes("@responder26_bot")) {
        log(`📨 Researcher → Responder: grade request`);
        setTimeout(() => triggerAgent("responder", msg, "responder", "researcher"), 2500);
      }
    }
  }

  // 2. Proposer → Responder (proposal)
  const proposerMsgs = readNewAssistantMessages("proposer");
  for (const msg of proposerMsgs) {
    if (msg === "NO_REPLY" || msg === "HEARTBEAT_OK" || msg.length < 15) continue;

    if (shouldRelayToResponder(msg)) {
      log(`📨 Proposer → Responder: proposal`);
      setTimeout(() => triggerAgent("responder", msg, "responder", "proposer"), 1500);
    }
    if (isGradeResponse(msg)) {
      log(`📋 Proposer grade buffered`);
      bufferGrade("proposer", msg);
    }
  }

  // 3. Responder → Proposer (decision) AND → Researcher (result)
  const responderMsgs = readNewAssistantMessages("responder");
  for (const msg of responderMsgs) {
    if (msg === "NO_REPLY" || msg === "HEARTBEAT_OK" || msg.length < 15) continue;

    if (isDecision(msg)) {
      // Relay decision to BOTH proposer (for transfer) and researcher (for round result)
      if (msg.includes("@proposer26_bot") || isAcceptance(msg)) {
        log(`📨 Responder → Proposer: ${isAcceptance(msg) ? "ACCEPTED" : "REJECTED"}`);
        setTimeout(() => triggerAgent("proposer", msg, "proposer", "responder"), 1500);
      }
      log(`📨 Responder → Researcher: round result`);
      setTimeout(() => triggerAgent("researcher", msg, "researcher", "responder"), 3000);
    }
    if (isGradeResponse(msg)) {
      log(`📋 Responder grade buffered`);
      bufferGrade("responder", msg);
    }
  }
}

// === Initialization ===
function initialize() {
  // Set initial state for all agents based on current session files
  for (const agentId of ["researcher", "proposer", "responder"]) {
    const fileInfo = getLatestSessionFile(agentId);
    if (fileInfo) {
      try {
        const content = fs.readFileSync(fileInfo.path, "utf8").trim();
        const lineCount = content ? content.split("\n").length : 0;
        state[agentId] = { file: fileInfo.path, lines: lineCount };
        log(`📋 ${agentId}: ${fileInfo.name} @ line ${lineCount}`);
      } catch (e) {
        state[agentId] = { file: null, lines: 0 };
      }
    } else {
      state[agentId] = { file: null, lines: 0 };
      log(`📋 ${agentId}: no session file yet`);
    }
  }
}

// === Start ===
if (!GROUP_ID) {
  console.error("❌ TELEGRAM_GROUP_ID is required and must be a numeric group ID (e.g. -1001234567890). Set it in .env or export before running.");
  process.exit(1);
}
log("🚀 Relay daemon v2 starting...");
log("   Group: (set)");
log(`   Poll interval: ${POLL_INTERVAL}ms`);
log(`   Agents dir: ${AGENTS_DIR}`);
log(`   OpenClaw: ${OPENCLAW}`);
log(`   Webhook: ${WEBHOOK_URL ? "(set)" : "disabled"}`);

initialize();

log("👂 Listening for agent messages...");
const timer = setInterval(poll, POLL_INTERVAL);

process.on("SIGINT", () => {
  log("🛑 Relay daemon shutting down");
  clearInterval(timer);
  process.exit(0);
});

process.on("SIGTERM", () => {
  log("🛑 Relay daemon shutting down");
  clearInterval(timer);
  process.exit(0);
});

// Keep-alive
process.on("uncaughtException", (err) => {
  log(`⚠️ Uncaught error: ${err.message}`);
});

