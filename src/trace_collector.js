class TraceCollector {
  constructor() {
    this.traceMap = {}
    this.funcCallMap = {}
  }

  add(address, traceLogs) {
    if (this.traceMap[address] === undefined) {
      this.traceMap[address] = []
    }
    if (traceLogs.structLogs !== undefined) {
      traceLogs = traceLogs.structLogs
    }
    this.traceMap[address].push(traceLogs)
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
    if (this.funcCallMap[address] === undefined) {
      this.funcCallMap[address] = []
    }
    if (!bytecodes.startsWith('0x')) {
      bytecodes = '0x' + bytecodes
    }
    this.funcCallMap[address].push(bytecodes.slice(0, 10))
  }
}

module.exports = TraceCollector
