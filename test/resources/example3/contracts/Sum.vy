hold_num: uint256

@public
def addNum(new_value : uint256):
    assert new_value > 0
    self.hold_num = self.hold_num + new_value

@public
@constant
def get() -> uint256:
    return self.hold_num
