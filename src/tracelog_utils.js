
const OpCode = {
  Create: 'CREATE',
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
      OpCode.Call,
      OpCode.CallCode,
      OpCode.StaticCall,
      OpCode.DelegateCall
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
  if(!isCallLike(traceData.op)) {
    throw new Error(`Not Call like opcode: ${traceData.op}`)
  }
  const [gas, address, wei, inaddr, insize] = normalizedCallDatas(traceData.op, traceData.stack)
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
  traceLogs.forEach((log) => {
    context.traceLogs.push(log)
    if(isCallLike(log.op)) {
      const analyzed = analyzeCallTarget(log)
      callStack.unshift(context) // save for changing context.
      context = {
        address: analyzed.address,
        functionId: analyzed.functionId,
        traceLogs: []
      }
      res.push(context) // save separated logs.
    } else if(isEndOpcode(log.op)) {
      context = callStack.pop()
    }
  })

  if(callStack.length > 0) {
    throw new Error("Invalid trace logs. The pair of `Call type opcode` and `Stop type opecode` is unmatching.")
  }

  return res
}

module.exports = {
  OpCode,
  analyzeCallTarget,
  separateTraceLogs
}
