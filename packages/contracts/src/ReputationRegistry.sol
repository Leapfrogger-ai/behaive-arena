// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {AgentRegistry} from "./AgentRegistry.sol";

/// @title ReputationRegistry
/// @notice Platform-signer pattern: agents sign EIP-712 inner payloads
///         attesting to peer scores; one hot platform relay submits the
///         batch on-chain so agents never touch gas. The contract verifies
///         each signature against the registered wallet in AgentRegistry.
///
///         Designed for ERC-8004 use: reputation is first-class, multi-
///         dimensional (dimension is a bytes32 — e.g. keccak256("fairness")),
///         and tied to a specific run so off-chain indexers can reconstruct
///         experiment-level aggregates.
contract ReputationRegistry {
    error UnknownAgent();
    error InvalidSignature();
    error BadScore();
    error EmptyBatch();

    event FeedbackSubmitted(
        uint256 indexed fromAgentId,
        uint256 indexed toAgentId,
        bytes32 indexed runId,
        bytes32 dimension,
        int8 score,
        uint64 submittedAt
    );

    AgentRegistry public immutable agents;
    bytes32 public immutable DOMAIN_SEPARATOR;

    bytes32 private constant FEEDBACK_TYPEHASH = keccak256(
        "Feedback(uint256 fromAgentId,uint256 toAgentId,bytes32 runId,bytes32 dimension,int8 score,uint256 nonce)"
    );

    mapping(address => uint256) public nonces;

    struct Feedback {
        uint256 fromAgentId;
        uint256 toAgentId;
        bytes32 runId;
        bytes32 dimension;
        int8 score;
        uint256 nonce;
        bytes signature;
    }

    constructor(AgentRegistry _agents) {
        agents = _agents;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("BehaiveReputationRegistry")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function submitFeedback(Feedback calldata f) external {
        _verifyAndEmit(f);
    }

    function submitFeedbackBatch(Feedback[] calldata batch) external {
        if (batch.length == 0) revert EmptyBatch();
        for (uint256 i = 0; i < batch.length; i++) {
            _verifyAndEmit(batch[i]);
        }
    }

    function hashFeedback(Feedback calldata f) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                FEEDBACK_TYPEHASH,
                f.fromAgentId,
                f.toAgentId,
                f.runId,
                f.dimension,
                f.score,
                f.nonce
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    function _verifyAndEmit(Feedback calldata f) internal {
        if (f.score < -100 || f.score > 100) revert BadScore();

        AgentRegistry.Agent memory from = agents.getAgent(f.fromAgentId);
        if (from.wallet == address(0)) revert UnknownAgent();
        if (agents.getAgent(f.toAgentId).wallet == address(0)) revert UnknownAgent();

        address signer = _recover(hashFeedback(f), f.signature);
        if (signer != from.wallet) revert InvalidSignature();
        if (f.nonce != nonces[from.wallet]) revert InvalidSignature();

        nonces[from.wallet] = f.nonce + 1;

        emit FeedbackSubmitted(
            f.fromAgentId,
            f.toAgentId,
            f.runId,
            f.dimension,
            f.score,
            uint64(block.timestamp)
        );
    }

    function _recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignature();
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
        return signer;
    }
}
