const CoverageSubprovider = require('../src/coverage_subprovider')
const ProviderEngine = require('web3-provider-engine')
const { expect } = require('chai')
const sinon = require('sinon')
const promisify = require('util').promisify

describe('coverage_subprovider.js', function() {
  let spy
  before(() => {
    spy = sinon.spy(console, 'warn')
  })
  after(() => spy.restore())

  describe('constructor', function() {
    it('should be set provider', async() => {
      expect(() => new CoverageSubprovider()).to.throw('no provider specified')
    })
    it('provider should have send or sendAsync method.', async() => {
      expect(() => new CoverageSubprovider({})).to.throw('specified provider does not have both sendAsync and send method')
    })
    it('success instanciation', async() => {
      const cs = new CoverageSubprovider({ send: () => {} })
      expect(cs).to.be.ok
    })
  })
  describe('handleRequest', function() {
    const engine = new ProviderEngine({ blockTracker: { on: () => {} } })
    engine.sendAsyncPromise = promisify(engine.sendAsync)
    const resDebugTrace = (id) => {
      return {
        'jsonrpc': '2.0',
        'id': id,
        'result': {
          'returnValue': 'OK',
          'status': 0,
          'structLogs': []
        }
      }
    }
    const resGetCode = (id) => {
      return {
        'jsonrpc': '2.0',
        'id': id,
        'result': '0x0000000000000000000000000000000000000000000000000000000000000000'
      }
    }
    const MockProvider = class MockProvider {
      sendAsync(payload, cb) {
        let response = resGetCode(payload.id)
        if (payload.method === 'debug_traceTransaction') { response = resDebugTrace(payload.id) }

        cb(null, response)
      }
    }
    const payload = (method = 'eth_call', to = '0x345ca3e014aaf5dca488057592ee47305d9b3e10') => {
      return {
        method: method,
        id: 1,
        params: [{
          to: to,
          data: '0x75278362'
        }]
      }
    }

    let mockProvider, cs, spy
    beforeEach(() => {
      mockProvider = new MockProvider()
      spy = sinon.spy(mockProvider, 'sendAsync')
      cs = new CoverageSubprovider(mockProvider, './test/resources/example1/build/contracts/**/*.json')
      engine.addProvider(cs)
      engine.start()
    })
    afterEach(() => {
      engine.removeProvider(cs)
      spy.restore()
    })
    it('eth_call', async() => {
      await engine.sendAsyncPromise(payload())
      const methods = spy.getCalls().map(call => call.args[0].method)
      expect(methods).to.have.lengthOf(4)
      expect(methods).to.deep.equal(['eth_call', 'eth_sendTransaction', 'debug_traceTransaction', 'eth_getCode'])
    })
    it('eth_sendTransaction', async() => {
      await engine.sendAsyncPromise(payload('eth_sendTransaction'))
      const methods = spy.getCalls().map(call => call.args[0].method)
      expect(methods).to.have.lengthOf(3)
      expect(methods).to.deep.equal(['eth_sendTransaction', 'debug_traceTransaction', 'eth_getCode'])
    })
    it('contract creation', async() => {
      const spyInnerCall = sinon.spy(cs, '_creationTraceAndCollect')
      await engine.sendAsyncPromise(payload('eth_sendTransaction', undefined))
      const methods = spy.getCalls().map(call => call.args[0].method)
      expect(methods).to.have.lengthOf(3)
      expect(spyInnerCall.calledOnce)
      expect(methods).to.deep.equal(['eth_sendTransaction', 'debug_traceTransaction', 'eth_getCode'])
    })
  })
})
