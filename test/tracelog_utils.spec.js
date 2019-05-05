const {analyzeCallTarget, separateTraceLogs} = require('../src/tracelog_utils')
const {expect} = require('chai')

const tracelog = {
  'depth': 0,
  'error': '',
  'gas': 6698944,
  'gasCost': 2,
  'memory': [
    '0000000000000000000000000000000000000000000000000000000075278362',
    '0000000000000000000000000000000000000000000000000000000000000059'
  ],
  'op': 'CALL',
  'pc': 257,
  'stack': [
    '0000000000000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000024',
    '000000000000000000000000000000000000000000000000000000000000001c',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '000000000000000000000000345ca3e014aaf5dca488057592ee47305d9b3e10',
    '00000000000000000000000000000000000000000000000000000000006637c0'
  ],
  'storage': null
}

const staticCallTraceLog = {
  'depth': 0,
  'error': '',
  'gas': 6676022,
  'gasCost': 2,
  'memory': [
    '0000000000000000000000000000000000000000000000000000000000000059',
    '0000000000000000000000000000000000000000000000000000000075278362',
    '0000000000000000000000000000000000000000000000000000000000000059',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '000000000000000000000000000000000000000000000000000000006d4ce63c'
  ],
  'op': 'STATICCALL',
  'pc': 318,
  'stack': [
    '0000000000000000000000000000000000000000000000000000000000000020',
    '0000000000000000000000000000000000000000000000000000000000000260',
    '0000000000000000000000000000000000000000000000000000000000000004',
    '00000000000000000000000000000000000000000000000000000000000000dc',
    '000000000000000000000000345ca3e014aaf5dca488057592ee47305d9b3e10',
    '000000000000000000000000000000000000000000000000000000000065de36'
  ],
  'storage': null
}
const push1TraceLog = {
  'depth': 0,
  'error': '',
  'gas': 6699149,
  'gasCost': 3,
  'memory': [],
  'op': 'PUSH1',
  'pc': 253,
  'stack': [],
  'storage': null
}

describe('tracelog_utils.js', function () {
  describe('analyzeCallTarget', function () {
    it('pure func check', async () => {
      const stackSave = [...tracelog.stack]
      const memorySave = [...tracelog.memory]
      analyzeCallTarget(tracelog)
      expect(tracelog.stack).to.deep.equal(stackSave)
      expect(tracelog.memory).to.deep.equal(memorySave)
    })
    it('call', async () => {
      const callData = analyzeCallTarget(tracelog)
      expect(callData['address']).to.equal('0x345ca3e014aaf5dca488057592ee47305d9b3e10')
      expect(callData['functionId']).to.equal('0x75278362')
    })
    it('static call', async () => {
      const callData = analyzeCallTarget(staticCallTraceLog)
      expect(callData['address']).to.equal('0x345ca3e014aaf5dca488057592ee47305d9b3e10')
      expect(callData['functionId']).to.equal('0x6d4ce63c')
    })
    it('invalid opcodes', async () => {
      expect(() => analyzeCallTarget(push1TraceLog)).to.throw('Not Call like opcode: PUSH1')
    })
  })
  describe('sparateTraceLogs', function () {
    const callLogs = require('./resources/multi_call_trace_logs')
    it('simple', async () => {
      const callData = separateTraceLogs(callLogs.structLogs)
      expect(callData).have.to.lengthOf(3)
      expect(callData.map(data => data.address)).to.deep.equal(['base', '0x345ca3e014aaf5dca488057592ee47305d9b3e10', '0x345ca3e014aaf5dca488057592ee47305d9b3e10'])
      expect(callData.map(data => data.functionId)).to.deep.equal(['base', '0x75278362', '0x6d4ce63c'])
    })
  })
})
