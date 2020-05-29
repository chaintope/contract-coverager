const { parse, posToLineConvertMap } = require('../src/solidity_source_map_parser')
const TruffleArtifactsResolver = require('../src/truffle_artifacts_resolver')
const { expect } = require('chai')

describe('solidity_source_map_parser.js', function() {
  const bytecodes = '0:10:0:-;;::1;2;:5;3:6;:8:0'
  describe('parse', function() {
    it('simple', async() => {
      const entries = parse(bytecodes)
      for (const e of entries) {
        for (const k of Object.keys(e)) {
          expect(e[k]).to.not.be.undefined
        }
      }
      expect(entries).to.have.lengthOf(7)
      expect(entries[0]).to.be.deep.equal({ offset: 0, length: 10, fileIndex: 0 })
      expect(entries[1]).to.be.deep.equal({ offset: 0, length: 10, fileIndex: 0 })
      expect(entries[2]).to.be.deep.equal({ offset: 0, length: 10, fileIndex: 1 })
      expect(entries[3]).to.be.deep.equal({ offset: 2, length: 10, fileIndex: 1 })
      expect(entries[4]).to.be.deep.equal({ offset: 2, length: 5, fileIndex: 1 })
      expect(entries[5]).to.be.deep.equal({ offset: 3, length: 6, fileIndex: 1 })
      expect(entries[6]).to.be.deep.equal({ offset: 3, length: 8, fileIndex: 0 })
    })
    it('actual', async() => {
      const resolver = new TruffleArtifactsResolver('test/resources/example3/build/contracts/**/*.json')
      await resolver.load()
      const cdata = resolver.contractsData[1]
      let entries = parse(cdata.sourceMap)
      for (const e of entries) {
        for (const k of Object.keys(e)) {
          expect(e[k]).to.not.be.undefined
        }
      }
      expect(entries).to.have.lengthOf(20)
      entries = parse(cdata.deployedSourceMap)
      expect(entries).to.have.lengthOf(280)
    })
  })
  describe('posToLineConvertMap', function() {
    const sampleSource = 'pragma solidity 5.7.0;\n\n\ncontract Sample {}'
    it('simple', async() => {
      const cmap = posToLineConvertMap(sampleSource)
      expect(cmap).to.have.lengthOf(43)
      expect(cmap[42].line).to.be.equal(3)
      expect(cmap[22]).to.be.deep.equal({ line: 0, col: 22 })
      expect(cmap[23]).to.be.deep.equal({ line: 1, col: 0 })
      expect(cmap[24]).to.be.deep.equal({ line: 2, col: 0 })
      expect(cmap[25]).to.be.deep.equal({ line: 3, col: 0 })
      expect(cmap[40]).to.be.deep.equal({ line: 3, col: 15 })
    })
    it('actual', async() => {
      const resolver = new TruffleArtifactsResolver('test/resources/example3/build/contracts/**/*.json')
      await resolver.load()
      const cdata = resolver.contractsData[1]
      const cmap = posToLineConvertMap(cdata.source)
      expect(cmap).to.have.lengthOf(225)
      expect(cmap[31]).to.be.deep.equal({ line: 0, col: 31 })
      expect(cmap[32]).to.be.deep.equal({ line: 1, col: 0 })
    })
  })
})
