import {
  decodeEventLog,
  encodeAbiParameters,
  getAddress,
  keccak256,
  toBytes,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { agentRegistryAbi, reputationRegistryAbi } from "./abi.js";
import { publicClient, walletClient, CHAIN } from "./client.js";

export interface FeedbackInput {
  fromAgentId: bigint;
  toAgentId: bigint;
  runId: Hex; // bytes32
  dimension: Hex; // bytes32
  score: number; // int8, -100..100
  nonce: bigint;
}

export interface SignedFeedback extends FeedbackInput {
  signature: Hex;
}

// Registers a new agent. Returns the emitted agentId by parsing the
// AgentRegistered event from the receipt.
export async function registerAgent(opts: {
  rpcUrl: string;
  registry: Address;
  signerKey: `0x${string}`;
  metadataHash: Hex;
}): Promise<{ agentId: bigint; txHash: Hash }> {
  const wc = walletClient(opts.rpcUrl, opts.signerKey);
  const pc = publicClient(opts.rpcUrl);

  const hash = await wc.writeContract({
    address: opts.registry,
    abi: agentRegistryAbi,
    functionName: "registerAgent",
    args: [opts.metadataHash],
  });
  const receipt = await pc.waitForTransactionReceipt({ hash });
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== opts.registry.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: agentRegistryAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "AgentRegistered") {
        return { agentId: decoded.args.agentId, txHash: hash };
      }
    } catch {
      // Skip logs from this address that don't match our ABI.
    }
  }
  throw new Error("AgentRegistered event not found in receipt");
}

// EIP-712 sign helper the arena-worker uses to produce inner-payload
// signatures on behalf of an ephemeral agent wallet. The platform signer
// then calls submitFeedbackBatch with these signed entries, so agents never
// touch gas.
export async function signFeedback(opts: {
  repRegistry: Address;
  agentKey: `0x${string}`;
  feedback: FeedbackInput;
}): Promise<SignedFeedback> {
  const account = privateKeyToAccount(opts.agentKey);
  const signature = await account.signTypedData({
    domain: {
      name: "BehaiveReputationRegistry",
      version: "1",
      chainId: CHAIN.id,
      verifyingContract: opts.repRegistry,
    },
    types: {
      Feedback: [
        { name: "fromAgentId", type: "uint256" },
        { name: "toAgentId", type: "uint256" },
        { name: "runId", type: "bytes32" },
        { name: "dimension", type: "bytes32" },
        { name: "score", type: "int8" },
        { name: "nonce", type: "uint256" },
      ],
    },
    primaryType: "Feedback",
    message: opts.feedback,
  });
  return { ...opts.feedback, signature };
}

export async function submitFeedbackBatch(opts: {
  rpcUrl: string;
  repRegistry: Address;
  platformSignerKey: `0x${string}`;
  batch: SignedFeedback[];
}): Promise<Hash> {
  const wc = walletClient(opts.rpcUrl, opts.platformSignerKey);
  return wc.writeContract({
    address: opts.repRegistry,
    abi: reputationRegistryAbi,
    functionName: "submitFeedbackBatch",
    args: [opts.batch],
  });
}

// Helper: turn a human dimension string into the canonical bytes32 the
// contract uses for indexed filtering.
export function dimensionKey(name: string): Hex {
  return keccak256(toBytes(name));
}

// Helper: content-hash a JSON metadata blob so the same hash anchors both
// on-chain AgentRegistry.metadataHash and off-chain Supabase Storage paths.
export function metadataHash(blob: string | object): Hex {
  const str = typeof blob === "string" ? blob : JSON.stringify(blob);
  return keccak256(toBytes(str));
}

export function asAddress(addr: string): Address {
  return getAddress(addr);
}

// Re-export for downstream convenience when typing agentRegistry calls.
export { encodeAbiParameters };
