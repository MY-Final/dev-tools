import { useState, useCallback, useMemo } from 'react'
import { copyText } from '@renderer/lib/clipboard'

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

const UNIT_ALIASES: Record<string, Unit> = {
  B: 'B',
  BYTE: 'B',
  BYTES: 'B',
  KB: 'KB',
  K: 'KB',
  KIB: 'KiB',
  KI: 'KiB',
  MB: 'MB',
  M: 'MB',
  MIB: 'MiB',
  MI: 'MiB',
  GB: 'GB',
  G: 'GB',
  GIB: 'GiB',
  GI: 'GiB',
  TB: 'TB',
  T: 'TB',
  TIB: 'TiB',
  TI: 'TiB'
}

const NUMBER_PATTERN = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?'
const PLAIN_NUMBER_RE = new RegExp(`^${NUMBER_PATTERN}$`)
const NUMBER_UNIT_RE = new RegExp(`^(${NUMBER_PATTERN})\\s*([a-zA-Z]+)$`)

/** 智能解析输入，例如 "10mb" → { value: 10, unit: 'MB' }。整串必须合法，避免 10abc 被静默当成 10。 */
export function parseInputWithUnit(input: string, activeUnit: Unit): ParsedInput {
  const trimmed = input.trim()
  if (!trimmed) return { value: NaN, unit: activeUnit }

  const withUnit = trimmed.match(NUMBER_UNIT_RE)
  if (withUnit) {
    const value = Number(withUnit[1])
    const unit = UNIT_ALIASES[withUnit[2].toUpperCase()]
    if (!unit || !Number.isFinite(value)) return { value: NaN, unit: activeUnit }
    return { value, unit }
  }

  if (!PLAIN_NUMBER_RE.test(trimmed)) return { value: NaN, unit: activeUnit }
  return { value: Number(trimmed), unit: activeUnit }
}

/** 输入单位自带进制（KB / KiB），换算时按它自己的进制解释，再以当前模式展示。 */
function toBytes(value: number, unit: Unit): number {
  if (unit in BINARY_TO_BYTES) return value * BINARY_TO_BYTES[unit as BinaryUnit]
  if (unit in DECIMAL_TO_BYTES) return value * DECIMAL_TO_BYTES[unit as DecimalUnit]
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
  // 整数字节数必须精确显示，否则 1 GiB → B 会被精度截成 1073741800。
  if (Number.isInteger(result)) return result.toString()
  return parseFloat(result.toPrecision(precision + 2)).toString()
}

export function convertToAllUnits(
  value: number,
  unit: Unit,
  mode: Mode,
  precision: number
): Record<string, string> {
  const bytes = toBytes(value, unit)
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

  const parsed = useMemo(
    () => parseInputWithUnit(activeValue, activeUnit),
    [activeValue, activeUnit]
  )

  const values = useMemo(() => {
    if (isNaN(parsed.value)) {
      const empty: Record<string, string> = {}
      for (const u of units) empty[u] = ''
      return empty
    }
    return convertToAllUnits(parsed.value, parsed.unit, mode, precision)
  }, [parsed, mode, precision, units])

  const invalid = activeValue.trim() !== '' && isNaN(parsed.value)

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
    async (unit: Unit) => {
      const val = values[unit]
      if (val) {
        const ok = await copyText(val)
        if (!ok) {
          showToast('复制失败，请手动选择')
          return
        }
        setCopiedUnit(unit)
        showToast('已复制到剪贴板')
        setTimeout(() => setCopiedUnit(null), 1500)
      }
    },
    [values, showToast]
  )

  const handleCopyAll = useCallback(async () => {
    if (!units.some((u) => values[u])) {
      showToast('没有可复制的结果')
      return
    }
    const text = units.map((u) => `${u}: ${values[u] || ''}`).join('\n')
    const ok = await copyText(text)
    showToast(ok ? '已复制全部结果' : '复制失败，请手动选择')
  }, [units, values, showToast])

  return {
    mode,
    precision,
    activeUnit,
    activeValue,
    parsedUnit: parsed.unit,
    invalid,
    hasValues: units.some((u) => values[u]),
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
