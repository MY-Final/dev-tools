/**
 * V8 的 JSON.parse 错误是英文且偏底层。这里把常见情形翻译成
 * 用户能直接行动的中文说明，供 JSON Formatter 与格式转换工具共用。
 */
export function describeJsonParseError(rawMessage: string): string {
  if (/Unexpected end of JSON input/i.test(rawMessage)) {
    return 'JSON 数据不完整，可能缺少引号、右括号或右方括号'
  }
  if (/Expected double-quoted property name/i.test(rawMessage)) {
    return '属性名必须使用双引号，或对象末尾多了逗号'
  }
  if (/Expected property name or '}'/i.test(rawMessage)) {
    return '缺少属性名，或对象末尾多了逗号'
  }
  if (/Expected ',' or '}'/i.test(rawMessage)) {
    return '对象属性之间缺少逗号，或缺少右花括号'
  }
  if (/Expected ',' or ']'/i.test(rawMessage)) {
    return '数组元素之间缺少逗号，或缺少右方括号'
  }
  if (/Unexpected token ']'/.test(rawMessage)) {
    return '数组末尾多了逗号'
  }
  if (/Unexpected token '}'/.test(rawMessage)) {
    return '对象末尾多了逗号'
  }
  if (/Unexpected token "'"/.test(rawMessage)) {
    return 'JSON 字符串必须使用双引号'
  }
  const tokenMatch = rawMessage.match(/Unexpected token '?(.+?)'?[,.]?(\s|$)/)
  if (tokenMatch?.[1]) {
    return `出现意外字符 ${tokenMatch[1]}`
  }
  return rawMessage
}
