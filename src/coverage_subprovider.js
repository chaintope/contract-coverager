const inherits = require('util').inherits
const promisify = require('util').promisify
const { separateTraceLogs } = require('./tracelog_utils')
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
 * @param jsonGlob file glob for *.json files.
 * @constructor
 */
function CoverageSubprovider(provider, jsonGlob = null) {
  if (!provider) throw new Error('CoverageSubprovider - no provider specified')
  if (!provider.sendAsync) {
    if (!provider.send) throw new Error('CoverageSubprovider - specified provider does not have both sendAsync and send method')
    provider.sendAsync = provider.send
  }
  this.provider = provider
  this.resolver = jsonGlob ? new TruffleArtifactResolver(jsonGlob) : new TruffleArtifactResolver()
  this.collector = new TraceCollector()
}

function debugTraceTransaction(txhash, cb) {
  const self = this
  self.emitPayload({
    method: 'debug_traceTransaction',
    params: [txhash, {
      disableStorage: true,
      disableMemory: true
      // disableStack: true
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

function injectInTruffle(artifacts, web3, fglob = null) {
  if (artifacts.require._coverageProvider) {
    return artifacts.require._coverageProvider
  }

  const csub = new CoverageSubprovider(web3.currentProvider, fglob)
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

  function findContract(contractAddress) {
    return async() => {
      if (!self.resolver.exists(contractAddress)) {
        const response = await self._getCode(contractAddress)
        if (response.result != null) { self.resolver.findByCodeHash(response.result, contractAddress) }
      }
    }
  }

  function getTraceAndCollect(contractAddress) {
    return async function(txHash) {
      const response = await self._debugTraceTransaction(txHash)
      // console.log(JSON.stringify(res))
      const separated = separateTraceLogs(response.result.structLogs)
      self.collector.add(contractAddress, separated[0].traceLogs)
      await findContract(contractAddress)()
      for (let i = 1; i < separated.length; i++) {
        const trace = separated[i]
        self.collector.recordFunctionCall({ to: trace.address, data: trace.functionId })
        self.collector.add(trace.address, trace.traceLogs)
        await findContract(trace.address)()
      }
    }
  }

  let traceFunc = async() => {}
  switch (payload.method) {
    case 'eth_call':
      self.collector.recordFunctionCall(payload.params[0])
      traceFunc = findContract(payload.params[0].to)
      break

    case 'eth_sendTransaction':
      const param = payload.params[0]
      if (!isNewContract(param.to) && param.data.length > 4) {
        self.collector.recordFunctionCall(param)
        traceFunc = getTraceAndCollect(param.to)
      }
      break
  }

  this.provider.sendAsync(payload, function(err, response) {
    if (err) return end(err)
    traceFunc(response.result).then(() => {
      if (response.error) return end(response.error.message)
      end(null, response.result)
    })
  })
}

CoverageSubprovider.prototype.start = function() {
  this.resolver.load()
}

CoverageSubprovider.prototype.stop = function() {
  const self = this
  const coverager = new Coverager(self.resolver, self.collector)
  coverager.report()
}
