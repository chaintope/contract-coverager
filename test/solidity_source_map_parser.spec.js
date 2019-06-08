const {parse, posToLineConvertMap} = require('../src/solidity_source_map_parser')
const TruffleArtifactsResolver = require('../src/truffle_artifacts_resolver')
const {expect} = require('chai')
const sinon = require('sinon')
const codeUtils = require('truffle-code-utils')

describe('solidity_source_map_parser.js', function () {
  const bytecodes = '0:10:0:-;;::1;2;:5;3:6;:8:0'
  describe('parse', function () {
    it('simple', async () => {
      const entries = parse(bytecodes)
      for (e of entries) {
        for (k of Object.keys(e)) {
          expect(e[k]).to.not.be.undefined
        }
      }
      expect(entries).to.have.lengthOf(7)
      expect(entries[0]).to.be.deep.equal({offset: 0, length: 10, fileIndex: 0})
      expect(entries[1]).to.be.deep.equal({offset: 0, length: 10, fileIndex: 0})
      expect(entries[2]).to.be.deep.equal({offset: 0, length: 10, fileIndex: 1})
      expect(entries[3]).to.be.deep.equal({offset: 2, length: 10, fileIndex: 1})
      expect(entries[4]).to.be.deep.equal({offset: 2, length: 5, fileIndex: 1})
      expect(entries[5]).to.be.deep.equal({offset: 3, length: 6, fileIndex: 1})
      expect(entries[6]).to.be.deep.equal({offset: 3, length: 8, fileIndex: 0})
    })
    it('actual', async () => {
      const resolver = new TruffleArtifactsResolver('test/resources/example3/build/contracts/**/*.json')
      await resolver.load()
      const cdata = resolver.contractsData[0]
      let entries = parse(cdata.sourceMap)
      for (e of entries) {
        for (k of Object.keys(e)) {
          expect(e[k]).to.not.be.undefined
        }
      }
      expect(entries).to.have.lengthOf(41)
      entries = parse(cdata.deployedSourceMap)
      expect(entries).to.have.lengthOf(347)

      // const sourceLines = cdata.source.split('\n')
      // const sourceMap = JSON.parse(cdata.sourceMap).pc_pos_map
      // console.log(cdata.bytecode.length / 2, cdata.deployedBytecode.length / 2)
      // const bytecode = cdata.deployedBytecode
      // console.log(bytecode)
      // const opcodes = codeUtils.parseCode(bytecode, bytecode.length)
      // const pcMapOpcodes = {}
      // opcodes.forEach(op => {
      //   pcMapOpcodes[op.pc] = op
      // })
      //
      // const countSourceMap = {}
      // Object.keys(sourceMap).map(key => {
      //   const value = sourceMap[key]
      //   countSourceMap[value] = Object.assign({count: 0, startPc: undefined}, countSourceMap[value])
      //   if(countSourceMap[value].startPc === undefined)
      //     countSourceMap[value].startPc = key
      //   countSourceMap[value].count += 1
      // })
      // Object.keys(sourceMap).map(key => {
      //   let index = parseInt(key)
      //   Object.assign(sourceMap[key], pcMapOpcodes[index])
      // })
      // // console.log(pcMapOpcodes)
      // console.log(sourceMap)
    })
  })
  describe('posToLineConvertMap', function () {
    const sample_source = 'pragma solidity 5.7.0;\n\n\ncontract Sample {}'
    it('simple', async () => {
      const cmap = posToLineConvertMap(sample_source)
      expect(cmap).to.have.lengthOf(43)
      expect(cmap[42].line).to.be.equal(3)
      expect(cmap[22]).to.be.deep.equal({line:0, col:22})
      expect(cmap[23]).to.be.deep.equal({line:1, col:0})
      expect(cmap[24]).to.be.deep.equal({line:2, col:0})
      expect(cmap[25]).to.be.deep.equal({line:3, col:0})
      expect(cmap[40]).to.be.deep.equal({line:3, col:15})
    })
    it('actual', async () => {
      const resolver = new TruffleArtifactsResolver('test/resources/example3/build/contracts/**/*.json')
      await resolver.load()
      const cdata = resolver.contractsData[0]
      const cmap = posToLineConvertMap(cdata.source)
      expect(cmap).to.have.lengthOf(515)
      expect(cmap[32]).to.be.deep.equal({line:0, col:32})
      expect(cmap[33]).to.be.deep.equal({line:1, col:0})
    })
  })
})
