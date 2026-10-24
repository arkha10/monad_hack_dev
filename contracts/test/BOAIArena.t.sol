// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BOAIArena} from "../src/BOAIArena.sol";

// forge-std is not installed in this repo and must not be added, so these are plain
// Solidity tests. Foundry discovers public `test*` functions on any contract.
// Revert assertions use try/catch instead of vm.expectRevert.

bytes32 constant HASH_1 = bytes32(uint256(1));
bytes32 constant HASH_2 = bytes32(uint256(2));
bytes32 constant HASH_3 = bytes32(uint256(3));
bytes32 constant HASH_4 = bytes32(uint256(4));

function selectorOf(bytes memory data) pure returns (bytes4 selector) {
    if (data.length < 4) return bytes4(0);
    assembly {
        selector := mload(add(data, 32))
    }
}

/// @dev Holds RECORDER_ROLE when it is the deployer. Wraps the arena calls so the test
///      contract can observe success/failure without cheatcodes.
contract RecorderActor {
    function tryRecord(BOAIArena arena, bytes32 matchId) external returns (bool ok, bytes4 err) {
        try arena.recordMatch(matchId, HASH_1, HASH_2, HASH_3, HASH_4) {
            return (true, bytes4(0));
        } catch (bytes memory reason) {
            return (false, selectorOf(reason));
        }
    }

    function tryAward(BOAIArena arena, bytes32 matchId, address recipient) external returns (bool ok, bytes4 err) {
        try arena.awardDemoReward(matchId, recipient) {
            return (true, bytes4(0));
        } catch (bytes memory reason) {
            return (false, selectorOf(reason));
        }
    }
}

/// @dev A second address with no role, calling from its own account.
contract OutsiderActor {
    function tryRecord(BOAIArena arena, bytes32 matchId) external returns (bool ok, bytes4 err) {
        try arena.recordMatch(matchId, HASH_1, HASH_2, HASH_3, HASH_4) {
            return (true, bytes4(0));
        } catch (bytes memory reason) {
            return (false, selectorOf(reason));
        }
    }

    function tryAward(BOAIArena arena, bytes32 matchId, address recipient) external returns (bool ok, bytes4 err) {
        try arena.awardDemoReward(matchId, recipient) {
            return (true, bytes4(0));
        } catch (bytes memory reason) {
            return (false, selectorOf(reason));
        }
    }
}

contract BOAIArenaTest is RecorderActor {
    BOAIArena private arena;
    OutsiderActor private outsider;

    bytes32 private constant MATCH_A = keccak256("match-boai-practice-001");
    bytes32 private constant MATCH_B = keccak256("match-boai-pvp-001");
    bytes32 private constant MISSING = keccak256("match-does-not-exist");

    function setUp() public {
        arena = new BOAIArena();
        outsider = new OutsiderActor();
    }

    function testConstructorGrantsRolesAndRecordsDeployer() public view {
        require(arena.recorder() == address(this), "deployer is the recorder");
        require(arena.hasRole(arena.DEFAULT_ADMIN_ROLE(), address(this)), "deployer is admin");
        require(arena.hasRole(arena.RECORDER_ROLE(), address(this)), "deployer can record");
        require(arena.RECORDER_ROLE() == keccak256("RECORDER_ROLE"), "role id is stable");
        require(arena.DEMO_REWARD_AMOUNT() == 1e18, "one whole demo unit per reward");
        require(keccak256(bytes(arena.name())) == keccak256("BOAI Demo Reward"), "token name");
        require(keccak256(bytes(arena.symbol())) == keccak256("BOAI-DEMO"), "token symbol");
        require(arena.decimals() == 18, "token decimals");
        require(arena.totalSupply() == 0, "no premint");
    }

    function testFreshMatchReadsAsAbsent() public view {
        require(!arena.isMatchRecorded(MISSING), "unrecorded is not recorded");
        require(!arena.isRewardClaimed(MISSING), "unrecorded is not claimed");
        require(arena.balanceOf(address(this)) == 0, "no starting balance");
    }

    function testRecorderCanRecordAndDuplicateIsRejected() public {
        (bool firstOk, bytes4 firstErr) = this.tryRecord(arena, MATCH_A);
        require(firstOk, "recorder records once");
        require(firstErr == bytes4(0), "no error on first record");
        require(arena.isMatchRecorded(MATCH_A), "match is recorded");
        require(!arena.isRewardClaimed(MATCH_A), "recording does not award");

        (bool secondOk, bytes4 secondErr) = this.tryRecord(arena, MATCH_A);
        require(!secondOk, "duplicate record reverts");
        require(secondErr == BOAIArena.MatchAlreadyRecorded.selector, "duplicate error is MatchAlreadyRecorded");
        require(arena.isMatchRecorded(MATCH_A), "state survives the rejected duplicate");
    }

    function testZeroMatchIdIsRejected() public {
        (bool ok, bytes4 err) = this.tryRecord(arena, bytes32(0));
        require(!ok, "zero matchId reverts");
        require(err == BOAIArena.EmptyMatchId.selector, "empty id error");
    }

    function testUnauthorizedCallerCannotRecord() public {
        (bool ok, bytes4 err) = outsider.tryRecord(arena, MATCH_A);
        require(!ok, "outsider cannot record");
        require(err != bytes4(0), "outsider gets an explicit revert");
        require(!arena.isMatchRecorded(MATCH_A), "no state written by outsider");
    }

    function testAdminCanGrantRecorderRole() public {
        address second = address(outsider);
        require(!arena.hasRole(arena.RECORDER_ROLE(), second), "no role before grant");

        arena.grantRole(arena.RECORDER_ROLE(), second);
        require(arena.hasRole(arena.RECORDER_ROLE(), second), "role after grant");

        (bool ok,) = outsider.tryRecord(arena, MATCH_B);
        require(ok, "granted recorder can record");
        require(arena.isMatchRecorded(MATCH_B), "granted recorder wrote state");
    }

    function testRewardMintsExactlyOnce() public {
        (bool recorded,) = this.tryRecord(arena, MATCH_A);
        require(recorded, "match recorded");

        (bool awarded, bytes4 awardErr) = this.tryAward(arena, MATCH_A, address(this));
        require(awarded, "reward awarded");
        require(awardErr == bytes4(0), "no error on first award");
        require(arena.isRewardClaimed(MATCH_A), "claim is recorded");
        require(arena.balanceOf(address(this)) == 1e18, "exactly one demo unit minted");
        require(arena.totalSupply() == 1e18, "supply matches the single award");

        (bool again, bytes4 againErr) = this.tryAward(arena, MATCH_A, address(this));
        require(!again, "second award reverts");
        require(againErr == BOAIArena.RewardAlreadyClaimed.selector, "repeat error is RewardAlreadyClaimed");
        require(arena.balanceOf(address(this)) == 1e18, "balance unchanged by rejected repeat");
        require(arena.totalSupply() == 1e18, "supply unchanged by rejected repeat");
    }

    function testRewardRequiresRecordedMatch() public {
        (bool ok, bytes4 err) = this.tryAward(arena, MISSING, address(this));
        require(!ok, "reward without record reverts");
        require(err == BOAIArena.MatchNotRecorded.selector, "missing-match error is MatchNotRecorded");
        require(arena.balanceOf(address(this)) == 0, "no balance minted");
    }

    function testRewardRejectsZeroAddress() public {
        (bool recorded,) = this.tryRecord(arena, MATCH_A);
        require(recorded, "match recorded");

        (bool ok, bytes4 err) = this.tryAward(arena, MATCH_A, address(0));
        require(!ok, "zero recipient reverts");
        require(err == BOAIArena.InvalidRecipient.selector, "zero recipient error");
        require(!arena.isRewardClaimed(MATCH_A), "failed award does not consume the claim");
    }

    function testUnauthorizedCallerCannotAward() public {
        (bool recorded,) = this.tryRecord(arena, MATCH_A);
        require(recorded, "match recorded");

        (bool ok, bytes4 err) = outsider.tryAward(arena, MATCH_A, address(outsider));
        require(!ok, "outsider cannot award");
        require(err != bytes4(0), "outsider gets an explicit revert");
        require(arena.balanceOf(address(outsider)) == 0, "outsider received nothing");
        require(!arena.isRewardClaimed(MATCH_A), "claim still open");
    }

    function testTwoMatchesPayTwoRecipients() public {
        (bool r1,) = this.tryRecord(arena, MATCH_A);
        (bool r2,) = this.tryRecord(arena, MATCH_B);
        require(r1 && r2, "both matches recorded");

        (bool a1,) = this.tryAward(arena, MATCH_A, address(this));
        (bool a2,) = this.tryAward(arena, MATCH_B, address(outsider));
        require(a1 && a2, "both rewards awarded");

        require(arena.balanceOf(address(this)) == 1e18, "first recipient balance");
        require(arena.balanceOf(address(outsider)) == 1e18, "second recipient balance");
        require(arena.totalSupply() == 2e18, "supply is per match");
    }

    function testErrorSelectorsAreStable() public pure {
        require(
            BOAIArena.MatchAlreadyRecorded.selector
                == bytes4(keccak256("MatchAlreadyRecorded(bytes32)")),
            "duplicate selector"
        );
        require(
            BOAIArena.MatchNotRecorded.selector == bytes4(keccak256("MatchNotRecorded(bytes32)")),
            "missing selector"
        );
        require(
            BOAIArena.RewardAlreadyClaimed.selector
                == bytes4(keccak256("RewardAlreadyClaimed(bytes32)")),
            "claimed selector"
        );
        require(BOAIArena.InvalidRecipient.selector == bytes4(keccak256("InvalidRecipient()")), "recipient selector");
        require(BOAIArena.EmptyMatchId.selector == bytes4(keccak256("EmptyMatchId()")), "empty selector");
    }
}
