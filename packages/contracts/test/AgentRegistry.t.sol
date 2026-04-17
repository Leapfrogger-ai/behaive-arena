// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry reg;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    bytes32 constant META_A = keccak256("agent-a");
    bytes32 constant META_B = keccak256("agent-b");

    function setUp() public {
        reg = new AgentRegistry();
    }

    function test_register_assignsSequentialIds() public {
        vm.prank(alice);
        uint256 id1 = reg.registerAgent(META_A);
        vm.prank(bob);
        uint256 id2 = reg.registerAgent(META_B);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(reg.walletToAgentId(alice), 1);
        assertEq(reg.walletToAgentId(bob), 2);
    }

    function test_register_rejectsDuplicate() public {
        vm.prank(alice);
        reg.registerAgent(META_A);
        vm.prank(alice);
        vm.expectRevert(AgentRegistry.AlreadyRegistered.selector);
        reg.registerAgent(META_B);
    }

    function test_updateMetadata_onlyOwner() public {
        vm.prank(alice);
        uint256 id = reg.registerAgent(META_A);
        vm.prank(bob);
        vm.expectRevert(AgentRegistry.NotOwner.selector);
        reg.updateMetadata(id, META_B);
        vm.prank(alice);
        reg.updateMetadata(id, META_B);
        assertEq(reg.getAgent(id).metadataHash, META_B);
    }

    function test_getAgent_revertsForUnknown() public {
        vm.expectRevert(AgentRegistry.UnknownAgent.selector);
        reg.getAgent(999);
    }
}
