// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BOAIArena} from "../src/BOAIArena.sol";
import {Vm} from "./Vm.sol";

/// @notice Deploys BOAIArena to Monad Testnet.
/// @dev Run with the RPC and key supplied by the environment only:
///
///      $env:MONAD_RPC_URL = "https://testnet-rpc.monad.xyz"
///      $env:PRIVATE_KEY = "<deployer key, never committed>"
///      forge script script/Deploy.s.sol --rpc-url $env:MONAD_RPC_URL --broadcast --network monad
///
///      The key is read by name from the environment and never logged. The deployer
///      becomes both DEFAULT_ADMIN_ROLE and RECORDER_ROLE, and is stored as `recorder`.
contract Deploy {
    Vm private constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    event Deployment(
        address indexed arena,
        address indexed recorder,
        string rpcUrl,
        string label
    );

    function run() external returns (BOAIArena arena) {
        string memory rpcUrl = vm.envString("MONAD_RPC_URL");
        require(bytes(rpcUrl).length > 0, "MONAD_RPC_URL is required");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        require(deployerKey != 0, "PRIVATE_KEY is required");

        vm.startBroadcast(deployerKey);
        arena = new BOAIArena();
        vm.stopBroadcast();

        emit Deployment(address(arena), arena.recorder(), rpcUrl, "TESTNET - TANPA NILAI UANG");
    }
}
