/**
 * Parsing and normalizing solidity sourceMap according to: https://solidity.readthedocs.io/en/v0.5.9/miscellaneous.html#source-mappings.
 *
 * @param sourceMap
 * @return {{offset: <int>, length: <int>, fileIndex: <int>}[]}
 */
function parse(sourceMap) {
  const items = sourceMap.split(';')
  const entries = items.map(i => i.split(':')).map(_toEntry)
  let previous
  return entries.map(e => {
    const newe = _extendsBeforeEntry(e, previous)
    previous = newe
    return newe
  })
}

/**
 * Convert to JSON from Solidity sourceMap format.
 * see: https://solidity.readthedocs.io/en/v0.5.9/miscellaneous.html#source-mappings
 *
 * @param items
 * @return {{offset: <int>, length: <int>, fileIndex: <int>}}
 * @private
 */
function _toEntry(items) {
  const [offset, length, fileIndex] = items.map(i => i === undefined || i === '' ? undefined : parseInt(i))
  return {
    offset,
    length,
    fileIndex
  }
}

/**
 * Copy field previous data to current if undefined of field of current data.
 * Entiry type: {
 * offset,
 * length,
 * fileIndex
 * }
 * @param current {{offset: <int>, length: <int>, fileIndex: <int>}}
 * @param before {{offset: <int>, length: <int>, fileIndex: <int>}}
 * @return {{offset: <int>, length: <int>, fileIndex: <int>}}
 * @private
 */
function _extendsBeforeEntry(current, before) {
  const res = Object.assign({}, current)
  if (res.offset === undefined) { res.offset = before.offset }
  if (res.length === undefined) { res.length = before.length }
  if (res.fileIndex === undefined) { res.fileIndex = before.fileIndex }

  return res
}

/**
 * Create Converting Map that is for source code binary pos to line No and column.
 *
 * @param source_datas
 * @return {Array}
 */
function posToLineConvertMap(sourceDatas) {
  let line = 0
  let col = 0
  const convertMap = []
  sourceDatas.split('').map((word, index) => {
    convertMap.push({ line, col })
    col += 1
    if (word === '\n') {
      line += 1
      col = 0
    }
  })
  convertMap.push({ line, col })
  return convertMap
}

/**
 * Provide the converted mapping information that the executable bytecode position is which line in source code.
 *
 * @param sourceMapJson: the source map info of bytecode.
 * @param linePosJson: the mapping info about line num and pos in source code.
 */
function convertInstructionMap(sourceMapJson, linePosJson) {
  return sourceMapJson.map(e => {
    const start = Object.assign(linePosJson[e.offset], {pos: e.offset})
    const endPos = e.offset + e.length
    const end = Object.assign(linePosJson[endPos], {pos: endPos})
    return {start,end}
  })
}

module.exports = {
  parse,
  posToLineConvertMap,
  convertInstructionMap
}
