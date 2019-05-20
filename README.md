Name
====

Overview

## Description
Coverage Tool for SmartContract.
Analayzing based on bytecodes and abi specification for functions.

## Requirement
Truffle v5.0.14 or higher.

```
## Install
`npm install contract-coverage`

## Usage
Add following code in your truffle test cases:
```js
const CoverageSubprovider = require('contract-coverager')
const engine = CoverageSubprovider.injectInTruffle(artifacts, web3)
```

and define before, after hook code:
```js
before(() => engine.start())
after(() => engine.stop())
```

example code overall:
```js
const CoverageSubprovider = require('contract-coverager')
const engine = CoverageSubprovider.injectInTruffle(artifacts, web3)
const VyperStorage = artifacts.require("VyperStorage")

contract("VyperStorage", (accounts) => {
  before(() => engine.start())
  after(() => engine.stop())

  it("...should store the value 89.", async () => {
    const storage = await VyperStorage.new()

    // Set value of 89
    const receipt = await storage.set(89)
    // Get stored value
    const storedData = await storage.get()
    assert.equal(storedData, 89, "The value 89 was not stored.")
  })
})
```

## CAUTION
if request method is eth_call, then this Lib re-request eth_sendTransaction with same params, for getting traceLogs.
so that, in using this coverage tool, more gas is consumes. may `out of gas` error a lot of happen.

## Demo
![](https://user-images.githubusercontent.com/1563840/58031554-9b583380-7b5b-11e9-80ee-a87cead6d210.png)

## Not yet support list
- Solidity's Contract (maybe available, but not tested)

## Licence
[GPLv3](https://github.com/nakajo2011/contract-coverage/blob/master/LICENCE)

## Author
[nakajo2011](https://github.com/nakajo2011)
