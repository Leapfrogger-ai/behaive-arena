// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract ReputationRegistryTest is Test {
    AgentRegistry agents;
    ReputationRegistry rep;

    uint256 aliceKey = 0xA11CE;
    uint256 bobKey = 0xB0B;
    address alice;
    address bob;

    uint256 aliceAgentId;
    uint256 bobAgentId;

    bytes32 runId = keccak256("run-1");
    bytes32 dimFair = keccak256("fairness");

    function setUp() public {
        alice = vm.addr(aliceKey);
        bob = vm.addr(bobKey);
        agents = new AgentRegistry();
        rep = new ReputationRegistry(agents);

        vm.prank(alice);
        aliceAgentId = agents.registerAgent(keccak256("alice-meta"));
        vm.prank(bob);
        bobAgentId = agents.registerAgent(keccak256("bob-meta"));
    }

    function _sign(uint256 pk, ReputationRegistry.Feedback memory f) internal view returns (bytes memory) {
        bytes32 digest = rep.hashFeedback(f);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _feedback(uint256 from, uint256 to, int8 score, uint256 nonce) internal view returns (ReputationRegistry.Feedback memory) {
        return ReputationRegistry.Feedback({
            fromAgentId: from,
            toAgentId: to,
            runId: runId,
            dimension: dimFair,
            score: score,
            nonce: nonce,
            signature: new bytes(0)
        });
    }

    function test_submitFeedback_validSignature() public {
        ReputationRegistry.Feedback memory f = _feedback(aliceAgentId, bobAgentId, 42, 0);
        f.signature = _sign(aliceKey, f);

        vm.expectEmit(true, true, true, true);
        emit ReputationRegistry.FeedbackSubmitted(aliceAgentId, bobAgentId, runId, dimFair, 42, uint64(block.timestamp));
        rep.submitFeedback(f);

        assertEq(rep.nonces(alice), 1);
    }

    function test_submitFeedback_rejectsWrongSigner() public {
        ReputationRegistry.Feedback memory f = _feedback(aliceAgentId, bobAgentId, 10, 0);
        // Bob signs a message claiming to be from Alice's agentId.
        f.signature = _sign(bobKey, f);
        vm.expectRevert(ReputationRegistry.InvalidSignature.selector);
        rep.submitFeedback(f);
    }

    function test_submitFeedback_rejectsReplay() public {
        ReputationRegistry.Feedback memory f = _feedback(aliceAgentId, bobAgentId, 10, 0);
        f.signature = _sign(aliceKey, f);
        rep.submitFeedback(f);
        vm.expectRevert(ReputationRegistry.InvalidSignature.selector);
        rep.submitFeedback(f);
    }

    function test_submitFeedback_rejectsOutOfRange() public {
        ReputationRegistry.Feedback memory f = _feedback(aliceAgentId, bobAgentId, 101, 0);
        f.signature = _sign(aliceKey, f);
        vm.expectRevert(ReputationRegistry.BadScore.selector);
        rep.submitFeedback(f);
    }

    function test_submitFeedbackBatch_advancesNonces() public {
        ReputationRegistry.Feedback[] memory batch = new ReputationRegistry.Feedback[](2);
        batch[0] = _feedback(aliceAgentId, bobAgentId, 10, 0);
        batch[0].signature = _sign(aliceKey, batch[0]);
        batch[1] = _feedback(aliceAgentId, bobAgentId, 20, 1);
        batch[1].signature = _sign(aliceKey, batch[1]);

        rep.submitFeedbackBatch(batch);
        assertEq(rep.nonces(alice), 2);
    }

    function test_submitFeedbackBatch_rejectsEmpty() public {
        ReputationRegistry.Feedback[] memory empty = new ReputationRegistry.Feedback[](0);
        vm.expectRevert(ReputationRegistry.EmptyBatch.selector);
        rep.submitFeedbackBatch(empty);
    }
}
