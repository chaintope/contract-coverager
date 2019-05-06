const Table = require('cli-table')
const colors = require('colors')
const { flatten, matchCalledFunction, matchUsedOpecodes, countUsed } = require('./match_helper')

/**
 *
 */
class Coverager {
  /**
   *
   * @param resolver TruffleArtifactsResolver
   * @param collector TraceCollector
   */
  constructor(resolver, collector) {
    this.resolver = resolver
    this.collector = collector
  }

  _matching() {
    const self = this
    const indexBaseAddressArray = []
    Object.keys(this.resolver.addressIndexMap).forEach(address => {
      const index = this.resolver.addressIndexMap[address]
      indexBaseAddressArray[index] = indexBaseAddressArray[index] || []
      indexBaseAddressArray[index].push(address)
    })

    const coverageRawDatas = {}
    indexBaseAddressArray.forEach((addrs, index) => {
      const rawData = {}
      rawData.contract = self.resolver.contractsData[index]
      const traces = addrs.map(addr => self.collector.traceMap[addr])
      const funcCalls = addrs.map(addr => self.collector.funcCallMap[addr])
      rawData.traces = flatten(traces)
      rawData.funcCalls = flatten(funcCalls)
      coverageRawDatas[rawData.contract.contractName] = rawData
    })
    return coverageRawDatas
  }

  report() {
    const self = this
    const matchingDatas = self._matching()

    let resultStr = '\n\n' + colors.bold.underline('Coverage report.\n')
    Object.keys(matchingDatas).forEach((contractName, index) => {
      resultStr += `(${index + 1}) ${contractName}\n`
      const data = matchingDatas[contractName]
      const numInstructions = data.contract.compiler.name === 'solc' ? null : data.contract.deployedBytecode.length / 2
      resultStr += this.reportUsedOpecodes(data.contract.deployedBytecode, data.traces, numInstructions)
      resultStr += this.reportMethodCalled(data.contract.functions, data.funcCalls)
      resultStr += '\n\n'
    })
    console.log(resultStr)
  }

  reportUsedOpecodes(bytecodes, structLogs, numInstructions) {
    const matching = matchUsedOpecodes(bytecodes, structLogs, numInstructions)
    const usedTotally = countUsed(matching)
    return `deployedBytecode coverage: ${Number((usedTotally * 100) / matching.length).toFixed(2)}% (${usedTotally}/${matching.length})\n`
  }

  reportMethodCalled(functions, calls) {
    const masLength = Math.max(...Object.keys(functions).map(sig => sig.length), 20)
    const table = new Table({ head: ['method', 'call count'], colWidths: [masLength + 2, 20], style: { head: ['bold'] } })
    let calledCount = 0
    let functionCount = 0
    Object.entries(matchCalledFunction(functions, calls)).forEach(item => {
      if (item[1] > 0) {
        calledCount++
        item[0] = colors.green(item[0])
      } else {
        item[0] = colors.red(item[0])
      }
      table.push(item)
      functionCount++
    })
    let res = `method coverage          : ${Number((calledCount * 100) / functionCount).toFixed(2)}% (${calledCount}/${functionCount})\n`
    res += table.toString()
    return res
  }
}

module.exports = Coverager
