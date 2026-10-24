pragma solidity ^0.8.28;
import {BOAIArena} from '../src/BOAIArena.sol';

contract BOAIArenaTest {
  function testRecordAndReward() public {
    BOAIArena arena = new BOAIArena(address(this));
    bytes32 id = keccak256('demo');
    arena.recordMatch(id, bytes32(1), bytes32(2), bytes32(3), bytes32(4));
    arena.awardDemoReward(id, address(this));
    require(arena.balanceOf(address(this)) == 1 ether);
  }
}
