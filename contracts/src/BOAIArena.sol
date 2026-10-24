// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract BOAIArena {
    address public immutable recorder;
    mapping(bytes32 => bool) private recorded;
    mapping(bytes32 => bool) private claimed;
    mapping(address => uint256) private balances;

    event MatchRecorded(bytes32 indexed matchId, bytes32 replayHash, bytes32 resultHash, bytes32 rulesetHash, bytes32 winnerCommitment);
    event DemoRewardAwarded(bytes32 indexed matchId, address indexed recipient, uint256 amount);

    constructor(address recorder_) { recorder = recorder_; }
    modifier onlyRecorder() { require(msg.sender == recorder, 'BOAI: recorder only'); _; }

    function recordMatch(bytes32 matchId, bytes32 replayHash, bytes32 resultHash, bytes32 rulesetHash, bytes32 winnerCommitment) external onlyRecorder {
        require(!recorded[matchId], 'BOAI: match recorded');
        recorded[matchId] = true;
        emit MatchRecorded(matchId, replayHash, resultHash, rulesetHash, winnerCommitment);
    }

    function awardDemoReward(bytes32 matchId, address recipient) external onlyRecorder {
        require(recorded[matchId], 'BOAI: match missing');
        require(!claimed[matchId], 'BOAI: reward claimed');
        claimed[matchId] = true;
        balances[recipient] += 1 ether;
        emit DemoRewardAwarded(matchId, recipient, 1 ether);
    }

    function isMatchRecorded(bytes32 matchId) external view returns (bool) { return recorded[matchId]; }
    function isRewardClaimed(bytes32 matchId) external view returns (bool) { return claimed[matchId]; }
    function balanceOf(address account) external view returns (uint256) { return balances[account]; }
}
