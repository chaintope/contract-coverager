const { countUsed, matchUsedOpecodes, matchCalledFunction } = require('../src/match_helper')
const { NEW_CONTRACT } = require('../src/constants')
const { expect } = require('chai')
const sinon = require('sinon')

const traceLogTemplate = {
  'depth': 0,
  'error': '',
  'gas': 6700511,
  'gasCost': 21464,
  'memory': null,
  'op': 'PUSH1',
  'pc': 0,
  'stack': [],
  'storage': null
}
const traceLogs = (...pcs) => {
  return pcs.map(no => {
    return Object.assign({}, traceLogTemplate, { pc: no })
  })
}

describe('match_helper.js', function() {
  const bytecodes = '0x6001600201'// PUSH1 1 PUSH1 2 ADD

  let spy
  before(() => {
    spy = sinon.spy(console, 'warn')
  })
  after(() => spy.restore())

  describe('matchUsedOpecodes', function() {
    it('matchUsed', async() => {
      let coverage = matchUsedOpecodes(bytecodes, traceLogs(0), bytecodes.length / 2)
      expect(coverage[0].vmTraces).to.equals(1)
      expect(coverage[1].vmTraces).to.be.undefined
      expect(coverage[2].vmTraces).to.be.undefined

      coverage = matchUsedOpecodes(bytecodes, traceLogs(0, 2), bytecodes.length / 2)
      expect(coverage[0].vmTraces).to.equals(1)
      expect(coverage[1].vmTraces).to.equals(1)
      expect(coverage[2].vmTraces).to.be.undefined

      coverage = matchUsedOpecodes(bytecodes, traceLogs(4, 4), bytecodes.length / 2)
      expect(coverage[0].vmTraces).to.be.undefined
      expect(coverage[1].vmTraces).to.be.undefined
      expect(coverage[2].vmTraces).to.equals(2)

      coverage = matchUsedOpecodes(bytecodes, traceLogs(0, 4, 0, 4), bytecodes.length / 2)
      expect(coverage[0].vmTraces).to.equals(2)
      expect(coverage[1].vmTraces).to.be.undefined
      expect(coverage[2].vmTraces).to.equals(2)
    })

    it('unknown pc', async() => {
      matchUsedOpecodes(bytecodes, traceLogs(0, 1), bytecodes.length / 2)
      expect(spy.calledWith('unknown program counter: 1, depth=0')).to.be.true
    })
  })

  describe('countUsed', function() {
    it('simple', async() => {
      let coverage = matchUsedOpecodes(bytecodes, traceLogs(0), bytecodes.length / 2)
      expect(countUsed(coverage)).to.equal(1)

      coverage = matchUsedOpecodes(bytecodes, traceLogs(4), bytecodes.length / 2)
      expect(countUsed(coverage)).to.equal(1)

      coverage = matchUsedOpecodes(bytecodes, traceLogs(0, 4), bytecodes.length / 2)
      expect(countUsed(coverage)).to.equal(2)

      coverage = matchUsedOpecodes(bytecodes, traceLogs(2, 2), bytecodes.length / 2)
      expect(countUsed(coverage)).to.equal(1)

      coverage = matchUsedOpecodes(bytecodes, traceLogs(0, 2, 4, 0, 2, 4), bytecodes.length / 2)
      expect(countUsed(coverage)).to.equal(3)
    })
  })

  describe('matchCalledFunction', function() {
    const functions = {
      'totalSupply()': '0x18160ddd',
      'balanceOf(address)': '0x70a08231',
      'transfer(address,uint256)': '0xa9059cbb'
    }
    it('simple', async() => {
      let matching = matchCalledFunction(functions, ['0x18160ddd'])
      expect(matching['totalSupply()']).to.equal(1)
      expect(matching['balanceOf(address)']).to.equal(0)
      expect(matching['transfer(address,uint256)']).to.equal(0)

      matching = matchCalledFunction(functions, ['0x18160ddd', '0x70a08231', '0xa9059cbb'])
      expect(matching['totalSupply()']).to.equal(1)
      expect(matching['balanceOf(address)']).to.equal(1)
      expect(matching['transfer(address,uint256)']).to.equal(1)

      matching = matchCalledFunction(functions, ['0x18160ddd', '0x70a08231', '0xa9059cbb', '0x70a08231'])
      expect(matching['totalSupply()']).to.equal(1)
      expect(matching['balanceOf(address)']).to.equal(2)
      expect(matching['transfer(address,uint256)']).to.equal(1)
    })
    it('create', async() => {
      let matching = matchCalledFunction({
        'totalSupply()': '0x18160ddd',
        'constructor()': NEW_CONTRACT
      }, [NEW_CONTRACT])
      expect(matching['constructor()']).to.equal(1)
      expect(matching['totalSupply()']).to.equal(0)
    })
  })

  describe('actual case', function() {
    const json = require('./resources/example1/build/contracts/VyperStorage')
    const actualDebugTrace = require('./resources/example1/debugTraceTransaction')
    it('simple', async() => {
      let coverage = matchUsedOpecodes(json.deployedBytecode, actualDebugTrace.structLogs, json.deployedBytecode.length / 2)
      expect(countUsed(coverage)).to.equal(47)
    })
  })
})
