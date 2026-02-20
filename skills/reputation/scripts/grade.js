#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const STORE = path.join(__dirname, "..", "reputation-store.json");

const graderId = process.argv[2];
const targetId = process.argv[3];
const score = parseInt(process.argv[4]);
const reason = process.argv[5] || "";

if (!graderId || !targetId || isNaN(score)) {
  console.log(JSON.stringify({ error: "Usage: grade.js <grader_id> <target_id> <score> [reason]" }));
  process.exit(1);
}

if (score < 0 || score > 100) {
  console.log(JSON.stringify({ error: "Score must be between 0 and 100" }));
  process.exit(1);
}

// Load or create store
let store = {};
try {
  store = JSON.parse(fs.readFileSync(STORE, "utf8"));
} catch (e) {
  store = {};
}

// Add grade
if (!store[targetId]) store[targetId] = { grades: [] };
store[targetId].grades.push({
  from: graderId,
  score,
  reason,
  timestamp: new Date().toISOString()
});

// Calculate average
const grades = store[targetId].grades;
const avg = Math.round(grades.reduce((s, g) => s + g.score, 0) / grades.length);
store[targetId].averageScore = avg;

fs.writeFileSync(STORE, JSON.stringify(store, null, 2));

console.log(JSON.stringify({
  success: true,
  grader: `Agent #${graderId}`,
  target: `Agent #${targetId}`,
  score,
  reason,
  newAverage: avg,
  totalGrades: grades.length
}));
