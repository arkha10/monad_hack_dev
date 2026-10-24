// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BOAIArena} from "../src/BOAIArena.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployBOAIArena {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (BOAIArena arena) {
        vm.startBroadcast();
        arena = new BOAIArena(msg.sender);
        vm.stopBroadcast();
    }
}
