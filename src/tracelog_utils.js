const { NEW_CONTRACT } = require('./constants')

const OpCode = {
  Create: 'CREATE',
  Create2: 'CREATE2',
  Call: 'CALL',
  CallCode: 'CALLCODE',
  StaticCall: 'STATICCALL',
  DelegateCall: 'DELEGATECALL',
  Revert: 'REVERT',
  Stop: 'STOP',
  Invalid: 'INVALID',
  Return: 'RETURN',
  SelfDestruct: 'SELFDESTRUCT'
}

function isCallLike(op) {
  return (
    [
      OpCode.Create,
      OpCode.Create2,
      OpCode.Call,
      OpCode.CallCode,
      OpCode.StaticCall,
      OpCode.DelegateCall
    ].indexOf(op) >= 0
  )
}

function isCreateLike(op) {
  return (
    [
      OpCode.Create,
      OpCode.Create2
    ].indexOf(op) >= 0
  )
}

function isEndOpcode(op) {
  return (
    [
      OpCode.Return,
      OpCode.Stop,
      OpCode.Revert,
      OpCode.Invalid,
      OpCode.SelfDestruct
    ].indexOf(op) >= 0
  )
}

function normalizedCallDatas(opcode, stack) {
  const reverseStack = [...stack].reverse()
  let gas, address, wei, inaddr, insize
  switch (opcode) {
    case OpCode.StaticCall:
    case OpCode.DelegateCall:
      [gas, address, inaddr, insize] = reverseStack
      wei = 0
      break
    default:
      [gas, address, wei, inaddr, insize] = reverseStack
      break
  }
  return [gas, address, wei, inaddr, insize]
}

function analyzeCallTarget(traceData) {
  if (!isCallLike(traceData.op)) {
    throw new Error(`Not Call like opcode: ${traceData.op}`)
  }
  if (isCreateLike(traceData.op)) {
    return { address: undefined, functionId: NEW_CONTRACT }
  }
  if (!traceData.stack) {
    return { address: 'unknown', functionId: 'unknown' }
  }
  const [, address,, inaddr, insize] = normalizedCallDatas(traceData.op, traceData.stack)
  if (!traceData.memory) {
    return { address: '0x' + address.slice(24), functionId: 'unknown' }
  }
  const flattenMemory = traceData.memory.reduce((flatten, hex) => flatten.concat(hex))
  const startPos = parseInt(inaddr, 16) * 2
  const endPos = startPos + parseInt(insize, 16) * 2
  const inputData = flattenMemory.slice(startPos, endPos)
  return {
    address: '0x' + address.slice(24), // extract botom 20 bytes
    functionId: '0x' + inputData.slice(0, 8) // extract 4 bytes
  }
}

/**
 * separate trace logs by each call opcode.
 * @param traceLogs
 * @return {Array}
 */
function separateTraceLogs(traceLogs) {
  const res = []
  const callStack = []
  let context = {
    address: 'base',
    functionId: 'base',
    traceLogs: []
  }
  res[0] = context
  let searchFunctionId = false
  traceLogs.forEach((log, index) => {
    context.traceLogs.push({ depth: log.depth, op: log.op, pc: log.pc })
    if (searchFunctionId && log.op === 'CALLDATALOAD') {
      context.functionId = '0x' + traceLogs[index + 1].stack[0]
      searchFunctionId = false
    }
    if (isCallLike(log.op)) {
      if (traceLogs[index + 1] && log.depth < traceLogs[index + 1].depth) {
        // if not increase depth then, send just ETH or precompiled contract.
        // so, not change context.
        const analyzed = analyzeCallTarget(log)
        callStack.push(context) // save for changing context.
        context = {
          address: analyzed.address,
          functionId: analyzed.functionId,
          traceLogs: [],
          type: log.op
        }
        if (context.functionId === 'unknown') {
          searchFunctionId = true
        }
        res.push(context) // save separated logs.
      }
    } else if (isEndOpcode(log.op)) {
      if (context.functionId === NEW_CONTRACT) {
        // if Return from CREATE or CREATE2, so new contract address is stored
        // stack top at next traceLog.
        context.address = '0x' + traceLogs[index + 1].stack[0].slice(24)
      }
      context = callStack.pop()
    }
  })

  if (callStack.length > 0) {
    throw new Error('Invalid trace logs. The pair of `Call type opcode` and `Stop type opecode` is unmatching.')
  }

  return res
}

module.exports = {
  OpCode,
  analyzeCallTarget,
  separateTraceLogs
}
