---
name: identity-8004
description: Look up ERC-8004 agent identity on Base Sepolia
version: 1.0.0
emoji: 🆔
metadata: {"openclaw":{"requires":{"env":["BASE_SEPOLIA_RPC"],"bins":["node"]},"primaryEnv":"BASE_SEPOLIA_RPC"}}
---

# ERC-8004 Agent Identity

Look up on-chain agent identity registered under the ERC-8004 standard on Base Sepolia.

## Lookup Agent
```bash
node ~/.openclaw/skills/identity-8004/scripts/lookup-agent.js <agent_id>
```

Returns the agent's registered identity information.

**Example:**
```bash
node ~/.openclaw/skills/identity-8004/scripts/lookup-agent.js 931
```

## Pre-Registered Agents

For the Ultimatum Game demo, these agents are pre-registered:
- **#931** — Researcher (0x4B727B5947AEDb36545cCBDC16E2a81B837C0103)
- **#932** — Proposer (0xB4305A685E7370b170F5005A4efd268e3DdB2A6E)
- **#933** — Responder (0x328DB42692f438Ab8D9e020Ac63ebF72508e7D34)

