// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

/// @title AgentRegistry
/// @notice Minimal ERC-8004-flavored agent identity registry. A wallet calls
///         `registerAgent` and receives a monotonically increasing agentId
///         bound to that wallet + an opaque metadata hash. The hash is the
///         content address of an off-chain JSON blob (persona, SOUL, model
///         spec) stored in Supabase Storage; we keep only the digest on-chain
///         so anyone can verify the metadata matches what the registry attests.
contract AgentRegistry {
    error AlreadyRegistered();
    error NotOwner();
    error UnknownAgent();

    event AgentRegistered(uint256 indexed agentId, address indexed wallet, bytes32 metadataHash);
    event AgentMetadataUpdated(uint256 indexed agentId, bytes32 newMetadataHash);

    struct Agent {
        address wallet;
        bytes32 metadataHash;
        uint64 registeredAt;
    }

    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) private _agents;
    mapping(address => uint256) public walletToAgentId;

    function registerAgent(bytes32 metadataHash) external returns (uint256 agentId) {
        if (walletToAgentId[msg.sender] != 0) revert AlreadyRegistered();
        agentId = nextAgentId++;
        _agents[agentId] = Agent({
            wallet: msg.sender,
            metadataHash: metadataHash,
            registeredAt: uint64(block.timestamp)
        });
        walletToAgentId[msg.sender] = agentId;
        emit AgentRegistered(agentId, msg.sender, metadataHash);
    }

    function updateMetadata(uint256 agentId, bytes32 newMetadataHash) external {
        Agent storage a = _agents[agentId];
        if (a.wallet == address(0)) revert UnknownAgent();
        if (a.wallet != msg.sender) revert NotOwner();
        a.metadataHash = newMetadataHash;
        emit AgentMetadataUpdated(agentId, newMetadataHash);
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        Agent memory a = _agents[agentId];
        if (a.wallet == address(0)) revert UnknownAgent();
        return a;
    }

    function isRegistered(address wallet) external view returns (bool) {
        return walletToAgentId[wallet] != 0;
    }
}
