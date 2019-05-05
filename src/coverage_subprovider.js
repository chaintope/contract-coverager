const inherits = require('util').inherits
const promisify = require('util').promisify
const Subprovider = require('web3-provider-engine/subproviders/subprovider')
const TraceCollector = require('./trace_collector')
const TruffleArtifactResolver = require('./truffle_artifacts_resolver')
const Coverager = require('./coverager')

const NonEmitterProvider = require('./non_emitter_provider')
const Web3ProviderEngine = require('web3-provider-engine')

module.exports = CoverageSubprovider

inherits(CoverageSubprovider, Subprovider)

/**
 * constractor
 * set artifact resolver for instanciation.
 *
 * @param provider Wrapped Provider(as web3.providers.HttpProvider)
 * @param resolver TruffleArtifactResolver (optional. if want to customize.)
 * @constructor
 */
function CoverageSubprovider(provider, resolver = new TruffleArtifactResolver()) {
  if (!provider) throw new Error('CoverageSubprovider - no provider specified')
  if (!provider.sendAsync) {
    if (!provider.send) throw new Error('CoverageSubprovider - specified provider does not have both sendAsync and send method')
    provider.sendAsync = provider.send
  }
  this.provider = provider
  this.resolver = resolver
  this.collecotr = new TraceCollector()
}

function debugTraceTransaction(txhash, cb) {
  const self = this
  self.emitPayload({
    method: 'debug_traceTransaction',
    params: [txhash, {
      disableStorage: true,
      disableMemory: true,
      disableStack: true
    }]
  }, cb)
}

function getCode(address, cb) {
  const self = this
  self.emitPayload({
    method: 'eth_getCode',
    params: [address]
  }, cb)
}

function isNewContract(address) {
  return (address === '0x' || address === '' || address === undefined)
}

function injectInTruffle(artifacts, web3) {
  if (artifacts.require._coverageProvider) {
    return artifacts.require._coverageProvider
  }

  const csub = new CoverageSubprovider(web3.currentProvider)
  const engine = new Web3ProviderEngine()
  engine.addProvider(csub)
  web3.setProvider(new NonEmitterProvider(engine))

  // proxy artifacts
  const oldRequire = artifacts.require
  artifacts.require = path => {
    const result = oldRequire(path)
    result.web3 = web3
    result.setProvider(web3.currentProvider)
    return result
  }
  artifacts.require._coverageProvider = web3.currentProvider
  return engine
}

CoverageSubprovider.injectInTruffle = injectInTruffle
CoverageSubprovider.prototype._debugTraceTransaction = promisify(debugTraceTransaction)
CoverageSubprovider.prototype._getCode = promisify(getCode)

CoverageSubprovider.prototype.handleRequest = function(payload, next, end) {
  const self = this

  function getTraceAndCollect(contractAddress) {
    return function(txHash) {
      self._debugTraceTransaction(txHash)
        .then(res => {
          self.collecotr.add(contractAddress, res.result)
          return self._getCode(contractAddress)
        })
        .then(getCodeResponse => {
          if (!self.resolver.exists(contractAddress)) {
            self.resolver.findByCodeHash(getCodeResponse.result, contractAddress)
          }
        })
    }
  }

  let traceFunc = function() {}
  switch (payload.method) {
    case 'eth_call':
      self.collecotr.recordFunctionCall(payload.params[0])
      break

    case 'eth_sendTransaction':
      const param = payload.params[0]
      if (!isNewContract(param.to) && param.data.length > 4) {
        self.collecotr.recordFunctionCall(param)
        //   next(getTraceAndCollect(param.to))
        // } else {
        //   next(null)
        traceFunc = getTraceAndCollect(param.to)
      }
      break
  }

  this.provider.sendAsync(payload, function(err, response) {
    if (err) return end(err)
    traceFunc(response.result)
    if (response.error) return end(new Error(response.error.message))
    end(null, response.result)
  })
}

CoverageSubprovider.prototype.start = function() {
  this.resolver.load()
}

CoverageSubprovider.prototype.stop = function() {
  const self = this
  const coverager = new Coverager(self.resolver, self.collecotr)
  coverager.report()
}
