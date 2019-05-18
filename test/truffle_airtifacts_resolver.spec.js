const AirtifactsResolver = require('../src/truffle_artifacts_resolver')
const { expect } = require('chai')

describe('truffle_artifacts_resolver.js', function() {
  describe('basic', function() {
    it('load', async() => {
      const resolver = new AirtifactsResolver('test/resources/example1/build/contracts/**/*.json')
      resolver.load()
      expect(resolver.contractsData).to.have.lengthOf(2)
      expect(resolver.contractsData[0].contractName).to.eq('Migrations')
      expect(resolver.contractsData[1].contractName).to.eq('VyperStorage')
    })
    it('listup functions', async() => {
      const resolver = new AirtifactsResolver('test/resources/example1/build/contracts/**/*.json')
      resolver.load()
      const functions = resolver.contractsData[1].functions
      const sigs = Object.keys(functions)
      expect(sigs).to.have.lengthOf(3)
      expect(sigs[0]).to.eq('constructor()')
      expect(sigs[1]).to.eq('set(uint256)')
      expect(sigs[2]).to.eq('get()')
    })
    it('constructor has args', async() => {
      const resolver = new AirtifactsResolver('test/resources/example2/build/contracts/**/*.json')
      resolver.load()
      const functions = resolver.contractsData[2].functions
      const sigs = Object.keys(functions)
      expect(sigs).to.have.lengthOf(3)
      expect(sigs[0]).to.eq('constructor(address)')
      expect(sigs[1]).to.eq('set(uint256)')
      expect(sigs[2]).to.eq('get()')
    })
  })
})
