// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Minimal shim for the Foundry cheatcode surface the deploy script needs.
///      forge-std is not installed and must not be added, so the two functions used by
///      Deploy.s.sol are declared here at the canonical cheatcode address. Tests do not
///      use this file.
interface Vm {
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
    function envUint(string calldata name) external returns (uint256);
    function envString(string calldata name) external returns (string memory);
}
