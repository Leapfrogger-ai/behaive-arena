#!/usr/bin/env node
const { ethers } = require("ethers");

const RPC = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
const USDC = process.env.USDC_CONTRACT || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const address = process.argv[2];

if (!address) {
  console.log(JSON.stringify({ error: "Usage: check-balance.js <address>" }));
  process.exit(1);
}

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const token = new ethers.Contract(USDC, ERC20_ABI, provider);
  const [balance, decimals] = await Promise.all([token.balanceOf(address), token.decimals()]);
  const formatted = ethers.formatUnits(balance, decimals);
  console.log(JSON.stringify({
    address,
    usdc_balance: formatted,
    raw_balance: balance.toString(),
    decimals: Number(decimals),
    contract: USDC,
    chain: "Base Sepolia (84532)"
  }));
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});

