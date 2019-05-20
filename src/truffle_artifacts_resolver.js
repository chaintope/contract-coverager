const glob = require('glob')
const fs = require('fs')
const keccak256 = require('keccak256')
const resolve = require('path').resolve
const { NEW_CONTRACT } = require('./constants')

function conscompleteSource(sourceData) {
  const s = Object.assign({}, sourceData)
  if (s.source === undefined) {
    s.source = fs.readFileSync(s.sourcePath, 'utf8')
  }
  return s
}

function bytecodeToBytecodeRegex(bytecode, compilerType) {
  let bytecodeRegex = bytecode
  // Library linking placeholder: __ConvertLib____________________________
    .replace(/_.*_/, '.*')
    // Libraries contain their own address at the beginning of the code and it's impossible to know it in advance
    .replace(
      /^0x730000000000000000000000000000000000000000/,
      '0x73........................................'
    )
  if (compilerType === 'solc') {
    // Last 86 characters is solidity compiler metadata that's different between compilations
    bytecodeRegex = bytecodeRegex.replace(/.{86}$/, '')
  }
  // HACK: Node regexes can't be longer that 32767 characters. Contracts bytecode can. We just truncate the regexes. It's safe in practice.
  const MAX_REGEX_LENGTH = 32767
  return bytecodeRegex.slice(0, MAX_REGEX_LENGTH)
}

const toTypeArray = (abiItem) => abiItem.inputs.map(input => input.type).join('.')
function abiRevertFunctionSignature(abiItem) {
  let signature = abiItem.name + '('
  signature += toTypeArray(abiItem)
  signature += ')'

  const funcId = '0x' + keccak256(signature).toString('hex').slice(0, 8)
  return { [funcId]: signature }
}

function extractFunctionsInfo(abi) {
  const res = {}
  // add constructor signature
  const constructor = 'constructor(' + abi.filter(item => item.type === 'constructor').map(toTypeArray) + ')'
  res[constructor] = NEW_CONTRACT
  // add functions signature
  const functions = abi.filter(item => item.type === 'function').map(abiRevertFunctionSignature)
    .reduce((reducer, item) => {
      const [funcId, signature] = Object.entries(item)[0]
      reducer[signature] = funcId
      return reducer
    }, {})
  return Object.assign(res, functions)
}

class TruffleArtifactsResolver {
  /**
   * Instanciation with json glob that builded by truffle.
   * @param fglob truffle's build json file glob.(default: 'build/contracts/** /*.json')
   */
  constructor(fglob = 'build/contracts/**/*.json') {
    this.artifactsGlob = fglob
    this.contractsData = []
    this.addressIndexMap = {}
  }

  /**
   * load contract infos from artifact.json created by truffle.
   */
  load() {
    const artifactFileNames = glob.sync(this.artifactsGlob, { absolute: true })
    if (artifactFileNames.length === 0) {
      throw new Error(`Not found artifacts json files. maybe wrong glob: ${this.artifactsGlob}`)
    }
    artifactFileNames.forEach(artifactFileName => {
      const artifact = require(resolve(artifactFileName))

      if (!artifact.bytecode) {
        console.warn(
          `${artifactFileName} doesn't contain bytecode. Skipping...`
        )
        return
      }
      const data = conscompleteSource(artifact)
      data.functions = extractFunctionsInfo(artifact.abi)
      this.contractsData.push(data)
    })
  }

  exists(address) {
    return this.addressIndexMap[address] !== undefined
  }

  /**
   * find and return contract datas that has same bytecode.
   * @param bytecodeHex bytecodes hex string.
   * @param address target contract address
   * @return {*}
   */
  findByCodeHash(bytecodeHex, address) {
    if (!bytecodeHex.startsWith('0x')) {
      throw new Error(`0x hex prefix missing: ${bytecodeHex}`)
    }
    const index = this.contractsData.findIndex(candidate => {
      if (
        candidate.bytecode.length === 2 ||
        candidate.deployedBytecode.length === 2
      ) {
        return false
      }
      const bytecodeRegex = bytecodeToBytecodeRegex(
        candidate.bytecode, candidate.compiler.name
      )
      const runtimeBytecodeRegex = bytecodeToBytecodeRegex(
        candidate.deployedBytecode, candidate.compiler.name
      )
      // We use that function to find by bytecode or runtimeBytecode. Those are quasi-random strings so
      // collisions are practically impossible and it allows us to reuse that code
      return (
        bytecodeHex === candidate.bytecode ||
        bytecodeHex === candidate.deployedBytecode ||
        new RegExp(`${bytecodeRegex}`, 'g').test(bytecodeHex) ||
        new RegExp(`${runtimeBytecodeRegex}`, 'g').test(bytecodeHex)
      )
    })
    if (index === -1) {
      // console.warn(`Unknown contract address: ${address}`)
    } else {
      this.addressIndexMap[address] = index
      return this.contractsData[index]
    }
  }
}

module.exports = TruffleArtifactsResolver
