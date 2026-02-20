---
name: reputation
description: Grade agents and retrieve reputation scores for the Ultimatum Game
version: 1.0.0
emoji: ⭐
metadata: {"openclaw":{"requires":{"bins":["node"]}}}
---

# Reputation System

Grade other agents and look up reputation scores. Scores are stored persistently and displayed in agent message headers.

## Grade an Agent
```bash
node ~/.openclaw/skills/reputation/scripts/grade.js <grader_agent_id> <target_agent_id> <score> "<reason>"
```

Score must be 0-100. Reason is a brief explanation.

**Example — Responder grades Proposer:**
```bash
node ~/.openclaw/skills/reputation/scripts/grade.js 933 932 75 "Fair offer of 0.45 USDC"
```

## Get Reputation
```bash
node ~/.openclaw/skills/reputation/scripts/get-reputation.js <agent_id>
```

Returns the agent's current average reputation score and grade history.

**Example:**
```bash
node ~/.openclaw/skills/reputation/scripts/get-reputation.js 932
```
