import { formatUnits, getAddress, parseUnits, type Address, type Hash } from "viem";
import { erc20Abi } from "./abi";
import { publicClient, walletClient } from "./client";

// Circle USDC on Base Sepolia (84532). Canonical testnet address.
export const USDC_BASE_SEPOLIA: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export interface SendUsdcArgs {
  rpcUrl: string;
  usdc?: Address;
  senderKey: `0x${string}`;
  to: string;
  amountHuman: string;
}

export interface SendUsdcResult {
  txHash: Hash;
  from: Address;
  to: Address;
  amount: string;
  blockNumber: bigint;
}

// Read-only USDC balance lookup — used by the worker to do a pre-send sanity
// check (mirrors the guard the legacy send-usdc.js script runs today).
export async function getUsdcBalance(rpcUrl: string, owner: Address, usdc: Address = USDC_BASE_SEPOLIA) {
  const pc = publicClient(rpcUrl);
  const [decimals, balance] = await Promise.all([
    pc.readContract({ address: usdc, abi: erc20Abi, functionName: "decimals" }),
    pc.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
  ]);
  return {
    decimals,
    balance,
    human: formatUnits(balance, decimals),
  };
}

export async function sendUsdc(args: SendUsdcArgs): Promise<SendUsdcResult> {
  const usdc = args.usdc ?? USDC_BASE_SEPOLIA;
  const to = getAddress(args.to); // checksum + validate
  const wc = walletClient(args.rpcUrl, args.senderKey);
  const pc = publicClient(args.rpcUrl);

  const decimals = await pc.readContract({
    address: usdc,
    abi: erc20Abi,
    functionName: "decimals",
  });
  const amountWei = parseUnits(args.amountHuman, decimals);

  // Pre-send guards so we fail loudly before the on-chain revert.
  const [balance, eth] = await Promise.all([
    pc.readContract({
      address: usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wc.account.address],
    }),
    pc.getBalance({ address: wc.account.address }),
  ]);
  if (balance < amountWei) {
    throw new Error(
      `insufficient USDC: have ${formatUnits(balance, decimals)}, need ${args.amountHuman}`,
    );
  }
  if (eth === 0n) {
    throw new Error("sender has no ETH for gas");
  }

  const hash = await wc.writeContract({
    address: usdc,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amountWei],
  });
  const receipt = await pc.waitForTransactionReceipt({ hash });

  return {
    txHash: hash,
    from: wc.account.address,
    to,
    amount: args.amountHuman,
    blockNumber: receipt.blockNumber,
  };
}
