// Hand-written ABI fragments for the on-chain surface the worker + web app
// use. Keeping the fragments minimal (rather than importing a full generated
// ABI) means we don't need a contracts build to compile the TS packages,
// which matters for CI environments without Foundry.

export const erc20Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export const agentRegistryAbi = [
  {
    type: "function",
    name: "registerAgent",
    stateMutability: "nonpayable",
    inputs: [{ name: "metadataHash", type: "bytes32" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "getAgent",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "wallet", type: "address" },
          { name: "metadataHash", type: "bytes32" },
          { name: "registeredAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "walletToAgentId",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "wallet", type: "address" },
      { indexed: false, name: "metadataHash", type: "bytes32" },
    ],
  },
] as const;

export const reputationRegistryAbi = [
  {
    type: "function",
    name: "submitFeedbackBatch",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "batch",
        type: "tuple[]",
        components: [
          { name: "fromAgentId", type: "uint256" },
          { name: "toAgentId", type: "uint256" },
          { name: "runId", type: "bytes32" },
          { name: "dimension", type: "bytes32" },
          { name: "score", type: "int8" },
          { name: "nonce", type: "uint256" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "FeedbackSubmitted",
    inputs: [
      { indexed: true, name: "fromAgentId", type: "uint256" },
      { indexed: true, name: "toAgentId", type: "uint256" },
      { indexed: true, name: "runId", type: "bytes32" },
      { indexed: false, name: "dimension", type: "bytes32" },
      { indexed: false, name: "score", type: "int8" },
      { indexed: false, name: "submittedAt", type: "uint64" },
    ],
  },
] as const;
