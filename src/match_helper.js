const codeUtils = require('truffle-code-utils')

function flatten(array) {
  return array.reduce((a, c) => {
    return Array.isArray(c) ? a.concat(flatten(c)) : a.concat(c)
  }, [])
}

function getPcToInstructionIndexMapping(opcodes) {
  const res = {}
  opcodes.forEach((item, index) => {
    res[item.pc] = index
  })
  return res
}

function matchUsedOpecodes(bytecodes, structLogs, numInstructions) {
  const opcodeStructs = codeUtils.parseCode(bytecodes, numInstructions)
  const pc2IndexMap = getPcToInstructionIndexMapping(opcodeStructs)
  const res = JSON.parse(JSON.stringify(opcodeStructs))
  structLogs.forEach(log => {
    const sm = res[pc2IndexMap[log.pc]]
    if (sm === undefined) {
      throw new Error(`unknown program counter: ${log.pc}, details:\n${JSON.stringify(log, null, '  ')}`)
    }
    sm.vmTraces = sm.vmTraces || 0
    sm.vmTraces++
  })
  return res
}

function matchCalledFunction(functions, calleds) {
  const res = {}
  Object.keys(functions).forEach(funcSig => {
    const funcId = functions[funcSig]
    res[funcSig] = calleds.filter(id => id === funcId).length
  })
  return res
}

function countUsed(opcodeStructs) {
  let total = 0
  opcodeStructs.forEach(item => {
    if (item.vmTraces) {
      total++
    }
  })
  return total
}

module.exports = {
  matchUsedOpecodes,
  matchCalledFunction,
  countUsed,
  flatten
}
