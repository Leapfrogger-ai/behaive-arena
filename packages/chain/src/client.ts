import { createPublicClient, createWalletClient, defineChain, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// Local anvil chain — used for the sandbox e2e. Declared here so we don't
// need to reach into viem's internals to set the id.
export const anvilLocal: Chain = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

// The chain the viem client targets defaults to Base Sepolia. Callers can
// override by env (CHAIN_ID=31337 → anvil, 84532 → Base Sepolia). Anything
// else falls back to Base Sepolia, which matches the production path.
export function resolveChain(chainId?: number): Chain {
  if (chainId === 31337) return anvilLocal;
  return baseSepolia;
}

export const CHAIN: Chain = resolveChain(
  process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : undefined,
);

export function publicClient(rpcUrl: string, chain: Chain = CHAIN) {
  return createPublicClient({
    chain,
    transport: http(rpcUrl, { batch: true }),
  });
}

export function walletClient(rpcUrl: string, privateKey: `0x${string}`, chain: Chain = CHAIN) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
}
