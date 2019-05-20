const { NEW_CONTRACT } = require('./constants')

const TRACE_LOG_TYPE = {
  FUNCTION: 'functionCall',
  CREATION: 'contractCreation'
}

class TraceCollector {
  constructor() {
    this.traceMap = {}
    this.funcCallMap = {}
  }

  /**
   * add called opecodes. Those are categorized by type, and then store.
   * @param address - contract address
   * @param traceLogs - debugTraces
   * @param type - TRACE_LOG_TYPE
   */
  add(address, traceLogs, type) {
    if (this.traceMap[address] === undefined) {
      this.traceMap[address] = {}
    }
    if (this.traceMap[address][type] === undefined) {
      Object.assign(this.traceMap[address], { [type]: [] })
    }
    if (traceLogs.structLogs !== undefined) {
      traceLogs = traceLogs.structLogs
    }
    this.traceMap[address][type].push(traceLogs)
  }

  recordFunctionCall(txRequestParams) {
    let bytecodes = txRequestParams.data
    const address = txRequestParams.to
    if (address === '0x' || address === '' || address === undefined) {
      // deployed transaction is not function call message.
      return
    }
    if (bytecodes.length < 8) {
      // console.warn(`Not Contract call message. ${JSON.stringify(txRequestParams)}`)
      return
    }
    if (!bytecodes.startsWith('0x')) {
      bytecodes = '0x' + bytecodes
    }
    this._push(address, bytecodes.slice(0, 10))
  }

  recordCreation(address) {
    this._push(address, NEW_CONTRACT)
  }

  _push(address, functionId) {
    if (this.funcCallMap[address] === undefined) {
      this.funcCallMap[address] = []
    }
    this.funcCallMap[address].push(functionId)
  }
}

module.exports = {
  TraceCollector,
  TRACE_LOG_TYPE
}
