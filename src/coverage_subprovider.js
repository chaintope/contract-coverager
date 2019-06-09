const inherits = require('util').inherits
const promisify = require('util').promisify
const { separateTraceLogs } = require('./tracelog_utils')
const Subprovider = require('web3-provider-engine/subproviders/subprovider')
const { TraceCollector, TRACE_LOG_TYPE } = require('./trace_collector')
const TruffleArtifactResolver = require('./truffle_artifacts_resolver')
const Coverager = require('./coverager')
const { NEW_CONTRACT } = require('./constants')

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
  this.jsonGlob = jsonGlob
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

function sendTransaction(param, cb) {
  const self = this
  self.emitPayload({
    method: 'eth_sendTransaction',
    params: [param]
  }, cb)
}

function getCode(address, cb) {
  const self = this
  self.emitPayload({
    method: 'eth_getCode',
    params: [address]
  }, cb)
}

function getReceipt(txhash, cb) {
  const self = this
  self.emitPayload({
    method: 'eth_getTransactionReceipt',
    params: [txhash]
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
  artifacts.require._coverageProvider = engine
  return engine
}

// define class methods
CoverageSubprovider.injectInTruffle = injectInTruffle

// promisifies
CoverageSubprovider.prototype._debugTraceTransaction = promisify(debugTraceTransaction)
CoverageSubprovider.prototype._sendTransaction = promisify(sendTransaction)
CoverageSubprovider.prototype._getCode = promisify(getCode)
CoverageSubprovider.prototype._getReceipt = promisify(getReceipt)

/**
 * record contract address by code that is gived from node.
 * @param contractAddress
 * @return {Function}
 */
CoverageSubprovider.prototype._findContract = function(contractAddress) {
  const self = this
  return async() => {
    if (!self.resolver.exists(contractAddress)) {
      const response = await self._getCode(contractAddress)
      if (response.result != null) { self.resolver.findByCodeHash(response.result, contractAddress) }
    }
  }
}

/**
 * record construcor trace infos.
 * @param initBytecodes
 * @return {Function}
 */
CoverageSubprovider.prototype._creationTraceAndCollect = function(initBytecodes) {
  const self = this
  return async function(txHash) {
    const receipt = await self._getReceipt(txHash)
    self.collector.recordCreation(receipt.result.contractAddress)
    self.resolver.findByCodeHash(initBytecodes, receipt.result.contractAddress)
    await self._functionCallTraceAndCollect(receipt.result.contractAddress, TRACE_LOG_TYPE.CREATE)(txHash)
  }
}

/**
 * getDebugTrace and record that.
 * @param contractAddress
 * @param traceType
 * @return {function(*=): *}
 */
CoverageSubprovider.prototype._functionCallTraceAndCollect = function(contractAddress, traceType) {
  const self = this
  return async function(txHash) {
    const response = await self._debugTraceTransaction(txHash)
    const separated = separateTraceLogs(response.result.structLogs)
    // separated[0] is start point.
    // it may be constructor case.
    self.collector.add(contractAddress, separated[0].traceLogs, traceType)
    await self._findContract(contractAddress)()
    for (let i = 1; i < separated.length; i++) {
      const trace = separated[i]
      if (trace.functionId === NEW_CONTRACT) {
        self.collector.recordCreation(trace.address)
        self.collector.add(trace.address, trace.traceLogs, TRACE_LOG_TYPE.CREATE)
      } else {
        self.collector.recordFunctionCall({ to: trace.address, data: trace.functionId })
        self.collector.add(trace.address, trace.traceLogs, TRACE_LOG_TYPE.FUNCTION)
      }
      await self._findContract(trace.address)()
    }
    return txHash
  }
}

CoverageSubprovider.prototype.handleRequest = function(payload, next, end) {
  const self = this
  let traceFunc = () => { return Promise.resolve('') }
  switch (payload.method) {
    case 'eth_call':
      if (payload.params[0].to) { // workaround for double count constructor when calling `new` method.
        traceFunc = () => self._sendTransaction(payload.params[0])
      }
      break

    case 'eth_sendTransaction':
      const param = payload.params[0]
      if (param.data && param.data.length > 4) { // data empty tx is just send ETH tx.
        if (isNewContract(param.to)) {
          traceFunc = self._creationTraceAndCollect(param.data)
        } else {
          self.collector.recordFunctionCall(param)
          traceFunc = self._functionCallTraceAndCollect(param.to, TRACE_LOG_TYPE.FUNCTION)
        }
      }
      break
  }

  this.provider.sendAsync(payload, function(err, response) {
    if (err) return end(err)
    traceFunc(response.result).then(res => {
      // check error just first response.
      if (response.error) return end(response.error.message)
      end(null, response.result)
    }).catch(e => end(e))
  })
}

CoverageSubprovider.prototype.start = function() {
  this.resolver = this.jsonGlob ? new TruffleArtifactResolver(this.jsonGlob) : new TruffleArtifactResolver()
  this.resolver.load()
  this.collector = new TraceCollector()
}

CoverageSubprovider.prototype.stop = function() {
  const self = this
  const coverager = new Coverager(self.resolver, self.collector)
  coverager.report()
}
