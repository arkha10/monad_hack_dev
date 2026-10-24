// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title BOAIArena
/// @notice Operator-attested BOAI match record plus a once-per-match demo reward.
/// @dev TESTNET ONLY. The ERC20 balance this contract tracks is a demo trophy for a
///      hackathon judge flow. It is not redeemable, not purchasable, not exchangeable for
///      BOAI_CREDIT and carries no monetary value (Rp0). There is no faucet, no mint entry
///      point for the public, no payable function, no upgrade path and no selfdestruct.
///
///      A recorded match moves through one state machine per matchId:
///      None -> Recorded -> Claimed. Modelling it as a single enum makes "claimed but
///      never recorded" unrepresentable instead of keeping two booleans in sync.
contract BOAIArena is ERC20, AccessControl {
    /// @notice Only holders may record a match or award a reward.
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    /// @notice Exactly one whole demo unit per recorded match.
    uint256 public constant DEMO_REWARD_AMOUNT = 1e18;

    enum MatchStatus {
        None,
        Recorded,
        Claimed
    }

    struct MatchRecord {
        bytes32 replayHash;
        bytes32 resultHash;
        bytes32 rulesetHash;
        bytes32 winnerCommitment;
        MatchStatus status;
    }

    /// @notice The deployer that received RECORDER_ROLE, recorded for auditability.
    address public immutable recorder;

    mapping(bytes32 matchId => MatchRecord) private matches;

    error EmptyMatchId();
    error MatchAlreadyRecorded(bytes32 matchId);
    error MatchNotRecorded(bytes32 matchId);
    error RewardAlreadyClaimed(bytes32 matchId);
    error InvalidRecipient();

    event MatchRecorded(
        bytes32 indexed matchId,
        bytes32 replayHash,
        bytes32 resultHash,
        bytes32 rulesetHash,
        bytes32 winnerCommitment
    );
    event DemoRewardAwarded(bytes32 indexed matchId, address indexed recipient, uint256 amount);

    constructor() ERC20("BOAI Demo Reward", "BOAI-DEMO") {
        recorder = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RECORDER_ROLE, msg.sender);
    }

    /// @notice Records the commitment for one completed match. Reverts on a duplicate id.
    function recordMatch(
        bytes32 matchId,
        bytes32 replayHash,
        bytes32 resultHash,
        bytes32 rulesetHash,
        bytes32 winnerCommitment
    ) external onlyRole(RECORDER_ROLE) {
        if (matchId == bytes32(0)) revert EmptyMatchId();
        if (matches[matchId].status != MatchStatus.None) revert MatchAlreadyRecorded(matchId);

        matches[matchId] = MatchRecord({
            replayHash: replayHash,
            resultHash: resultHash,
            rulesetHash: rulesetHash,
            winnerCommitment: winnerCommitment,
            status: MatchStatus.Recorded
        });

        emit MatchRecorded(matchId, replayHash, resultHash, rulesetHash, winnerCommitment);
    }

    /// @notice Mints the single demo reward for a recorded, unclaimed match.
    function awardDemoReward(bytes32 matchId, address recipient) external onlyRole(RECORDER_ROLE) {
        if (recipient == address(0)) revert InvalidRecipient();

        MatchStatus status = matches[matchId].status;
        if (status == MatchStatus.None) revert MatchNotRecorded(matchId);
        if (status == MatchStatus.Claimed) revert RewardAlreadyClaimed(matchId);

        matches[matchId].status = MatchStatus.Claimed;
        _mint(recipient, DEMO_REWARD_AMOUNT);

        emit DemoRewardAwarded(matchId, recipient, DEMO_REWARD_AMOUNT);
    }

    function isMatchRecorded(bytes32 matchId) external view returns (bool) {
        return matches[matchId].status != MatchStatus.None;
    }

    function isRewardClaimed(bytes32 matchId) external view returns (bool) {
        return matches[matchId].status == MatchStatus.Claimed;
    }
}
