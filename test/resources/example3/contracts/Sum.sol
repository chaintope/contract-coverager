pragma solidity >0.4.99 <0.6.0;

contract Sum {
  uint256 public result;
  function exec(uint256[] memory _nums) public {
    result = 0;
    for(uint i=0; i<_nums.length; i++) {
      result = result + _nums[i];
    }
  }
}
