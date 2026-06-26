import { useState, useCallback, useMemo } from 'react'

export type Mode = 'binary' | 'decimal'

export const BINARY_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const
export const DECIMAL_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const
export type BinaryUnit = (typeof BINARY_UNITS)[number]
export type DecimalUnit = (typeof DECIMAL_UNITS)[number]
export type Unit = BinaryUnit | DecimalUnit

const BINARY_TO_BYTES: Record<BinaryUnit, number> = {
  B: 1,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4
}

const DECIMAL_TO_BYTES: Record<DecimalUnit, number> = {
  B: 1,
  KB: 1000,
  MB: 1000 ** 2,
  GB: 1000 ** 3,
  TB: 1000 ** 4
}

export function getUnitsForMode(mode: Mode): readonly Unit[] {
  return mode === 'binary' ? BINARY_UNITS : DECIMAL_UNITS
}

export function getDefaultUnit(mode: Mode): Unit {
  return mode === 'binary' ? 'KiB' : 'KB'
}

export interface ParsedInput {
  value: number
  unit: Unit
}

/** 智能解析输入，例如 "10mb" → { value: 10, unit: 'MB' } */
export function parseInputWithUnit(input: string, activeUnit: Unit): ParsedInput {
  const trimmed = input.trim()
  // 尝试匹配 "数字 + 单位" 格式
  const match = trimmed.match(/^(-?[\d.]+)\s*([a-zA-Z]+)$/)
  if (match) {
    const num = parseFloat(match[1])
    const unitStr = match[2].toUpperCase()
    const allUnits = [...BINARY_UNITS, ...DECIMAL_UNITS]
    const found = allUnits.find(
      (u) =>
        u.toUpperCase() === unitStr ||
        u.toUpperCase() === unitStr + 'B' ||
        u.toUpperCase() === unitStr + 'IB'
    )
    if (found && !isNaN(num)) {
      return { value: num, unit: found as Unit }
    }
  }
  // 纯数字，使用当前活跃单位
  return { value: parseFloat(trimmed), unit: activeUnit }
}

function toBytes(value: number, unit: Unit, mode: Mode): number {
  if (mode === 'binary' && unit in BINARY_TO_BYTES) {
    return value * BINARY_TO_BYTES[unit as BinaryUnit]
  }
  if (mode === 'decimal' && unit in DECIMAL_TO_BYTES) {
    return value * DECIMAL_TO_BYTES[unit as DecimalUnit]
  }
  return value
}

function fromBytes(bytes: number, unit: Unit, mode: Mode, precision: number): string {
  let divisor = 1
  if (mode === 'binary' && unit in BINARY_TO_BYTES) {
    divisor = BINARY_TO_BYTES[unit as BinaryUnit]
  } else if (mode === 'decimal' && unit in DECIMAL_TO_BYTES) {
    divisor = DECIMAL_TO_BYTES[unit as DecimalUnit]
  }
  const result = bytes / divisor
  if (result === 0) return '0'
  return parseFloat(result.toPrecision(precision + 2)).toString()
}

export function convertToAllUnits(
  value: number,
  unit: Unit,
  mode: Mode,
  precision: number
): Record<string, string> {
  const bytes = toBytes(value, unit, mode)
  const units = getUnitsForMode(mode)
  const result: Record<string, string> = {}
  for (const u of units) {
    result[u] = fromBytes(bytes, u, mode, precision)
  }
  return result
}

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export function useConverter() {
  const [mode, setMode] = useState<Mode>('binary')
  const [precision, setPrecision] = useState(6)
  const [activeUnit, setActiveUnit] = useState<Unit>(getDefaultUnit('binary'))
  const [activeValue, setActiveValue] = useState('')
  const [toast, setToast] = useState('')
  const [copiedUnit, setCopiedUnit] = useState<Unit | null>(null)

  const units = useMemo(() => getUnitsForMode(mode), [mode])

  const values = useMemo(() => {
    const parsed = parseInputWithUnit(activeValue, activeUnit)
    if (isNaN(parsed.value)) {
      const empty: Record<string, string> = {}
      for (const u of units) empty[u] = ''
      return empty
    }
    return convertToAllUnits(parsed.value, parsed.unit, mode, precision)
  }, [activeValue, activeUnit, mode, precision, units])

  const handleInputChange = useCallback((unit: Unit, input: string) => {
    setActiveUnit(unit)
    setActiveValue(input)
  }, [])

  const handleModeChange = useCallback((newMode: Mode) => {
    setMode(newMode)
    setActiveUnit(getDefaultUnit(newMode))
  }, [])

  const handlePrecisionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setPrecision(parseInt(e.target.value))
  }, [])

  const handleQuickConvert = useCallback((value: string, unit: Unit) => {
    setActiveValue(value)
    setActiveUnit(unit)
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 1500)
  }, [])

  const handleCopyValue = useCallback(
    (unit: Unit) => {
      const val = values[unit]
      if (val) {
        navigator.clipboard.writeText(val)
        setCopiedUnit(unit)
        showToast('已复制到剪贴板')
        setTimeout(() => setCopiedUnit(null), 1500)
      }
    },
    [values, showToast]
  )

  const handleCopyAll = useCallback(() => {
    const text = units.map((u) => `${u}: ${values[u] || ''}`).join('\n')
    navigator.clipboard.writeText(text)
    showToast('已复制全部结果')
  }, [units, values, showToast])

  return {
    mode,
    precision,
    activeUnit,
    activeValue,
    toast,
    copiedUnit,
    units,
    values,
    handleInputChange,
    handleModeChange,
    handlePrecisionChange,
    handleQuickConvert,
    handleCopyValue,
    handleCopyAll
  }
}
