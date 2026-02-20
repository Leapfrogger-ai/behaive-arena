#!/usr/bin/env node
const { ethers } = require("ethers");

const RPC = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
const address = process.argv[2];

if (!address) {
  console.log(JSON.stringify({ error: "Usage: check-eth.js <address>" }));
  process.exit(1);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const balance = await provider.getBalance(address);
  console.log(JSON.stringify({
    address,
    eth_balance: ethers.formatEther(balance),
    raw_balance: balance.toString(),
    chain: "Base Sepolia (84532)"
  }));
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
