// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {AgentRegistry} from "./AgentRegistry.sol";

/// @title IdentityResolver
/// @notice View-only convenience contract for off-chain indexers and wallets
///         that only want the (wallet, metadataHash) tuple for an agentId.
///         Keeping this separate from AgentRegistry lets us swap read
///         strategies later (e.g. Merkle roots over metadata blobs) without
///         migrating the canonical registry.
contract IdentityResolver {
    AgentRegistry public immutable agents;

    constructor(AgentRegistry _agents) {
        agents = _agents;
    }

    function resolve(uint256 agentId) external view returns (address wallet, bytes32 metadataHash) {
        AgentRegistry.Agent memory a = agents.getAgent(agentId);
        return (a.wallet, a.metadataHash);
    }

    function resolveWallet(address wallet) external view returns (uint256 agentId, bytes32 metadataHash) {
        agentId = agents.walletToAgentId(wallet);
        if (agentId == 0) return (0, bytes32(0));
        AgentRegistry.Agent memory a = agents.getAgent(agentId);
        metadataHash = a.metadataHash;
    }
}
