// for workaround of not call `eth_subscribe` in web3-core-method, when MyContract.new.
// https://github.com/ethereum/web3.js/blob/1d9f6c0889c7f551b4ec1041cece0d50bc3ff2c8/packages/web3-core-method/src/index.js#L412-L415
//
// The workaround is that wrap Web3ProviderEngine with provider what no have `on` method.

/**
 * constructor. need Web3ProviderEngine.
 * @param providerEngine
 * @constructor
 */
function NonEmitterProvider(providerEngine) {
  const self = this
  if (!providerEngine) throw new Error('NonEmitterProvider - no Web3ProviderEngine specified')
  self.engine = providerEngine
}

NonEmitterProvider.prototype.send = function(payload, cb) {
  const self = this
  self.engine.sendAsync(payload, cb)
}

module.exports = NonEmitterProvider
