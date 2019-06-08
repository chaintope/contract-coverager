contract Sum():
    def addNum(new_value: uint256): modifying
    def get() -> uint256: constant

sum_contract: Sum
stored_data: uint256

@public
def __init__(sum_address: address):
    assert sum_address != ZERO_ADDRESS
    self.sum_contract = Sum(sum_address)

@public
def set(new_value : uint256):
    assert new_value > 2
    self.sum_contract.addNum(new_value)
    s: uint256 = self.sum_contract.get()
    self.stored_data = s

@public
@constant
def get() -> uint256:
    return self.stored_data
