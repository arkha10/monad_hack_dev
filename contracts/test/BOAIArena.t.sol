// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BOAIArena} from '../src/BOAIArena.sol';

interface Vm {
    function prank(address) external;
    function expectRevert(bytes calldata) external;
}

contract BOAIArenaTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    BOAIArena arena;
    address recorder = address(0x1111);
    address alice = address(0x2222);

    bytes32 constant matchId = keccak256("match-001");
    bytes32 constant replayHash = keccak256("replay-001");
    bytes32 constant resultHash = keccak256("result-001");
    bytes32 constant rulesetHash = keccak256("ruleset-001");
    bytes32 constant winnerCommitment = keccak256("winner-001");

    function setUp() public {
        arena = new BOAIArena(recorder);
    }

    function test_InitialState() public view {
        require(arena.recorder() == recorder, "wrong recorder");
        require(!arena.isMatchRecorded(matchId), "match should not be recorded");
        require(!arena.isRewardClaimed(matchId), "reward should not be claimed");
        require(arena.balanceOf(alice) == 0, "balance should be zero");
    }

    function test_RecordMatch_Success() public {
        vm.prank(recorder);
        arena.recordMatch(matchId, replayHash, resultHash, rulesetHash, winnerCommitment);

        require(arena.isMatchRecorded(matchId), "match should be recorded");
        require(!arena.isRewardClaimed(matchId), "reward should not be claimed yet");
    }

    function test_RecordMatch_RevertIfNotRecorder() public {
        vm.prank(alice);
        vm.expectRevert("BOAI: recorder only");
        arena.recordMatch(matchId, replayHash, resultHash, rulesetHash, winnerCommitment);
    }

    function test_RecordMatch_RevertIfDuplicate() public {
        vm.prank(recorder);
        arena.recordMatch(matchId, replayHash, resultHash, rulesetHash, winnerCommitment);

        vm.prank(recorder);
        vm.expectRevert("BOAI: match recorded");
        arena.recordMatch(matchId, replayHash, resultHash, rulesetHash, winnerCommitment);
    }

    function test_AwardDemoReward_Success() public {
        vm.prank(recorder);
        arena.recordMatch(matchId, replayHash, resultHash, rulesetHash, winnerCommitment);

        vm.prank(recorder);
        arena.awardDemoReward(matchId, alice);

        require(arena.isRewardClaimed(matchId), "reward should be claimed");
        require(arena.balanceOf(alice) == 1 ether, "alice should have 1 ether demo token");
    }

    function test_AwardDemoReward_RevertIfNotRecorder() public {
        vm.prank(recorder);
        arena.recordMatch(matchId, replayHash, resultHash, rulesetHash, winnerCommitment);

        vm.prank(alice);
        vm.expectRevert("BOAI: recorder only");
        arena.awardDemoReward(matchId, alice);
    }

    function test_AwardDemoReward_RevertIfMatchMissing() public {
        vm.prank(recorder);
        vm.expectRevert("BOAI: match missing");
        arena.awardDemoReward(matchId, alice);
    }

    function test_AwardDemoReward_RevertIfAlreadyClaimed() public {
        vm.prank(recorder);
        arena.recordMatch(matchId, replayHash, resultHash, rulesetHash, winnerCommitment);

        vm.prank(recorder);
        arena.awardDemoReward(matchId, alice);

        vm.prank(recorder);
        vm.expectRevert("BOAI: reward claimed");
        arena.awardDemoReward(matchId, alice);
    }
}
