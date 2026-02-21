#!/usr/bin/env node
const { ethers } = require("ethers");

const RPC = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
const USDC = process.env.USDC_CONTRACT || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

const recipient = process.argv[2];
const amount = process.argv[3];

if (!PRIVATE_KEY) {
  console.log(JSON.stringify({ error: "WALLET_PRIVATE_KEY environment variable required" }));
  process.exit(1);
}
if (!recipient || !amount) {
  console.log(JSON.stringify({ error: "Usage: WALLET_PRIVATE_KEY=<key> send-usdc.js <recipient> <amount>" }));
  process.exit(1);
}

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const token = new ethers.Contract(USDC, ERC20_ABI, wallet);

  const decimals = await token.decimals();
  const amountWei = ethers.parseUnits(amount, decimals);

  // Check balance first
  const balance = await token.balanceOf(wallet.address);
  if (balance < amountWei) {
    console.log(JSON.stringify({
      error: "Insufficient USDC balance",
      balance: ethers.formatUnits(balance, decimals),
      required: amount
    }));
    process.exit(1);
  }

  // Check ETH for gas
  const ethBalance = await provider.getBalance(wallet.address);
  if (ethBalance === 0n) {
    console.log(JSON.stringify({ error: "No ETH for gas fees" }));
    process.exit(1);
  }

  // Send transfer
  const tx = await token.transfer(recipient, amountWei);
  const receipt = await tx.wait();

  console.log(JSON.stringify({
    success: true,
    from: wallet.address,
    to: recipient,
    amount: amount + " USDC",
    txHash: receipt.hash,
    explorer: `https://sepolia.basescan.org/tx/${receipt.hash}`,
    blockNumber: receipt.blockNumber,
    chain: "Base Sepolia (84532)"
  }));
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});

