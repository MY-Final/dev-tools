/** 将快捷键字符串格式化为显示文本 */
export function formatShortcut(shortcut: string): string {
  return shortcut
    .replace(/Ctrl/g, navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
    .replace(/Alt/g, 'Alt')
    .replace(/Shift/g, 'Shift')
    .replace(/Meta/g, '⌘')
    .replace(/(\w+)\+/g, '$1 + ')
    .replace(/\+/g, ' + ')
}

/** 解析快捷键字符串，判断 KeyboardEvent 是否匹配 */
export function matchShortcut(shortcut: string, e: KeyboardEvent): boolean {
  const parts = shortcut.toLowerCase().split('+')
  const key = parts[parts.length - 1]!
  const mods = parts.slice(0, -1)

  // 特殊键名映射
  const keyMap: Record<string, string> = {
    escape: 'escape',
    enter: 'enter',
    space: ' ',
    ',': ',',
    '.': '.',
    tab: 'tab',
    backspace: 'backspace',
    delete: 'delete',
    arrowup: 'arrowup',
    arrowdown: 'arrowdown',
    arrowleft: 'arrowleft',
    arrowright: 'arrowright',
    home: 'home',
    end: 'end',
    pageup: 'pageup',
    pagedown: 'pagedown',
    f1: 'f1', f2: 'f2', f3: 'f3', f4: 'f4',
    f5: 'f5', f6: 'f6', f7: 'f7', f8: 'f8',
    f9: 'f9', f10: 'f10', f11: 'f11', f12: 'f12'
  }

  const expectedKey = keyMap[key] || key
  if (e.key.toLowerCase() !== expectedKey) return false

  const hasCtrl = mods.includes('ctrl')
  const hasAlt = mods.includes('alt')
  const hasShift = mods.includes('shift')
  const hasMeta = mods.includes('meta')

  if (hasCtrl !== e.ctrlKey) return false
  if (hasAlt !== e.altKey) return false
  if (hasShift !== e.shiftKey) return false
  if (hasMeta !== e.metaKey) return false

  return true
}

/** 从 KeyboardEvent 生成快捷键字符串 */
export function keyEventToShortcut(e: KeyboardEvent): string | null {
  // 忽略单独的修饰键
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Meta')

  let key = e.key
  // 标点符号特殊处理
  if (key === ',') key = ','
  else if (key === '.') key = '.'
  else if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  else key = key.charAt(0).toUpperCase() + key.slice(1)

  parts.push(key)
  return parts.join('+')
}
