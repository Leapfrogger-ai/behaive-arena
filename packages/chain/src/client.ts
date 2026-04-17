import { createPublicClient, createWalletClient, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

export const CHAIN: Chain = baseSepolia;

export function publicClient(rpcUrl: string) {
  return createPublicClient({
    chain: CHAIN,
    transport: http(rpcUrl, { batch: true }),
  });
}

export function walletClient(rpcUrl: string, privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: CHAIN,
    transport: http(rpcUrl),
  });
}
