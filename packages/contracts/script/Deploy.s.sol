// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {IdentityResolver} from "../src/IdentityResolver.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        AgentRegistry agents = new AgentRegistry();
        ReputationRegistry rep = new ReputationRegistry(agents);
        IdentityResolver resolver = new IdentityResolver(agents);

        console.log("AgentRegistry:", address(agents));
        console.log("ReputationRegistry:", address(rep));
        console.log("IdentityResolver:", address(resolver));

        vm.stopBroadcast();
    }
}
