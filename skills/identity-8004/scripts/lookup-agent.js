#!/usr/bin/env node

// Pre-registered agent identities for the Ultimatum Game demo
// In production, this would query the ERC-8004 Identity Registry contract on Base Sepolia
const AGENTS = {
  "931": {
    agentId: 931,
    role: "Researcher",
    address: "0x4B727B5947AEDb36545cCBDC16E2a81B837C0103",
    registeredOn: "Base Sepolia",
    standard: "ERC-8004"
  },
  "932": {
    agentId: 932,
    role: "Proposer",
    address: "0xB4305A685E7370b170F5005A4efd268e3DdB2A6E",
    registeredOn: "Base Sepolia",
    standard: "ERC-8004"
  },
  "933": {
    agentId: 933,
    role: "Responder",
    address: "0x328DB42692f438Ab8D9e020Ac63ebF72508e7D34",
    registeredOn: "Base Sepolia",
    standard: "ERC-8004"
  }
};

const agentId = process.argv[2];
if (!agentId) {
  console.log(JSON.stringify({ error: "Usage: lookup-agent.js <agent_id>" }));
  process.exit(1);
}

const agent = AGENTS[agentId];
if (!agent) {
  console.log(JSON.stringify({ error: `Agent #${agentId} not found in registry` }));
  process.exit(1);
}

console.log(JSON.stringify(agent));
