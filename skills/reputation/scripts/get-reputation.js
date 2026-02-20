#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const STORE = path.join(__dirname, "..", "reputation-store.json");
const agentId = process.argv[2];

if (!agentId) {
  console.log(JSON.stringify({ error: "Usage: get-reputation.js <agent_id>" }));
  process.exit(1);
}

let store = {};
try {
  store = JSON.parse(fs.readFileSync(STORE, "utf8"));
} catch (e) {
  store = {};
}

const data = store[agentId];
if (!data || data.grades.length === 0) {
  console.log(JSON.stringify({
    agentId: `#${agentId}`,
    averageScore: null,
    totalGrades: 0,
    message: "No reputation scores yet"
  }));
  process.exit(0);
}

console.log(JSON.stringify({
  agentId: `#${agentId}`,
  averageScore: data.averageScore,
  totalGrades: data.grades.length,
  recentGrades: data.grades.slice(-5)
}));
