// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {IdentityResolver} from "../src/IdentityResolver.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        AgentRegistry agents = new AgentRegistry();
        ReputationRegistry rep = new ReputationRegistry(agents);
        IdentityResolver resolver = new IdentityResolver(agents);

        // MockUSDC is for anvil / local dev. On Base Sepolia the chain
        // helpers default to Circle's 0x036CbD… address and skip this.
        MockUSDC usdc = new MockUSDC();

        console.log("AgentRegistry:", address(agents));
        console.log("ReputationRegistry:", address(rep));
        console.log("IdentityResolver:", address(resolver));
        console.log("MockUSDC:", address(usdc));

        vm.stopBroadcast();
    }
}
