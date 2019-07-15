const Coverager = require('../src/coverager')
const {TraceCollector, TRACE_LOG_TYPE} = require('../src/trace_collector')
const TruffleArtifactsResolver = require('../src/truffle_artifacts_resolver')
const {expect} = require('chai')
const sinon = require('sinon')

const Table = require('cli-table')
const colors = require('colors')
const callLogs = require('./resources/example3/callActualLog')

const staticReport = (coverager, index, contractName, usedTotally, matchingLength, createTotally, constructorCodes) => {
  let resStr = '\n\n' + colors.bold.underline('Coverage report.\n')
  resStr += `(${index + 1}) ${contractName}\n`
  resStr += coverager._percentageReport('deployedBytecode coverage', usedTotally, matchingLength)
  resStr += coverager._percentageReport('constructor code coverage', createTotally, constructorCodes)
  return resStr
}

describe('coverager.js', function () {
  describe('report', function () {
    let spy
    let coverager, resolver, collector, address
    beforeEach(async () => {
      spy = sinon.spy(console, 'log')
      resolver = new TruffleArtifactsResolver('test/resources/example3/build/contracts/**/*.json')
      collector = new TraceCollector()
      await resolver.load()
      const cdata = resolver.contractsData[1]
      address = callLogs.getFunctionCall.to
      resolver.findByCodeHash(cdata.bytecode, address)
      coverager = new Coverager(resolver, collector)
    })

    afterEach(() => spy.restore())
    const functions = {
      'constructor()': 'NEW_CONTRACT',
      'result()': '0x65372147',
      'exec(uint256[])': '0xb35dcce7'
    }
    it('empty', async () => {
      expect(resolver.exists(address)).to.be.true

      coverager.report()

      let reportExpect = staticReport(coverager, 0, 'Sum', 0, 281, 0, 21)
      const calls = [undefined]
      reportExpect += coverager.reportMethodCalled(functions, calls) + '\n\n'

      const outReport = spy.firstCall.args[0]
      expect(outReport).to.be.equal(reportExpect)
    })
    it('article', async () => {
      expect(resolver.exists(address)).to.be.true

      const actualLogs = require('./resources/example3/callActualLog')
      collector.recordCreation(address)
      collector.recordFunctionCall(actualLogs.setFunctionCall)
      collector.recordFunctionCall((actualLogs.getFunctionCall))
      collector.add(address, actualLogs.createTrace, TRACE_LOG_TYPE.CREATION)
      collector.add(address, actualLogs.setTraceLog, TRACE_LOG_TYPE.FUNCTION)
      collector.add(address, actualLogs.getTraceLog, TRACE_LOG_TYPE.FUNCTION)

      coverager.report()

      let reportExpect = staticReport(coverager, 0, 'Sum', 257, 281, 17, 21)
      const calls = ['NEW_CONTRACT', '0x65372147', '0xb35dcce7']
      reportExpect += coverager.reportMethodCalled(functions, calls) + '\n\n'
      const outReport = spy.firstCall.args[0]
      expect(outReport).to.be.equal(reportExpect)
    })
  })
})
