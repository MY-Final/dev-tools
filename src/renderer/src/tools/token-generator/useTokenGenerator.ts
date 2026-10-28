import { useState, useCallback } from 'react'
import {
  base64UrlEncodeText,
  randomString,
  signJwtHmac
} from '@renderer/lib/crypto-utils'

export type TokenType = 'uuid' | 'jwt' | 'api-key' | 'random-string' | 'secret-key'

export type RandomStringCharset = 'uppercase' | 'lowercase' | 'digits' | 'special'

export interface JwtPayload {
  sub: string
  role: string
  [key: string]: string
}

export interface TokenConfig {
  uuid: {
    count: number
  }
  jwt: {
    header: string
    payload: string
    secret: string
    expiration: string
  }
  'api-key': {
    prefix: string
    length: number
  }
  'random-string': {
    length: number
    charset: RandomStringCharset[]
  }
  'secret-key': {
    length: number
  }
}

type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512'

const DEFAULT_CONFIG: TokenConfig = {
  uuid: { count: 1 },
  jwt: {
    header: JSON.stringify({ alg: 'HS256', typ: 'JWT' }, null, 2),
    payload: JSON.stringify({ sub: '10001', role: 'admin' }, null, 2),
    secret: 'my-secret-key',
    expiration: '1h'
  },
  'api-key': {
    prefix: 'pk_live',
    length: 24
  },
  'random-string': {
    length: 32,
    charset: ['uppercase', 'lowercase', 'digits']
  },
  'secret-key': { length: 64 }
}

const CHARSET_MAP: Record<RandomStringCharset, string> = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getJwtAlgorithm(value: unknown): JwtAlgorithm | null {
  return value === 'HS256' || value === 'HS384' || value === 'HS512' ? value : null
}

function generateUUID(): string {
  return crypto.randomUUID()
}

function generateRandomString(length: number, charsets: RandomStringCharset[]): string {
  let chars = ''
  for (const charset of charsets) {
    chars += CHARSET_MAP[charset]
  }
  if (!chars) chars = CHARSET_MAP.lowercase + CHARSET_MAP.digits
  return randomString(length, chars)
}

function generateApiKey(prefix: string, length: number): string {
  const randomPart = generateRandomString(length, ['lowercase', 'digits', 'uppercase'])
  return `${prefix}_${randomPart}`
}

function generateSecretKey(length: number): string {
  return generateRandomString(length, ['uppercase', 'lowercase', 'digits'])
}

async function generateJWT(
  header: string,
  payload: string,
  secret: string,
  expiration: string
): Promise<string> {
  try {
    const parsedHeader: unknown = JSON.parse(header)
    const parsedPayload: unknown = JSON.parse(payload)
    if (!isRecord(parsedHeader) || !isRecord(parsedPayload)) {
      return 'Invalid JSON in header or payload'
    }

    const algorithm = getJwtAlgorithm(parsedHeader.alg) ?? 'HS256'
    parsedHeader.alg = algorithm

    const now = Math.floor(Date.now() / 1000)
    let expSeconds = 3600
    if (expiration === '15m') expSeconds = 900
    else if (expiration === '1h') expSeconds = 3600
    else if (expiration === '1d') expSeconds = 86400
    else if (expiration === '7d') expSeconds = 604800
    else if (expiration === '30d') expSeconds = 2592000

    parsedPayload.iat = now
    parsedPayload.exp = now + expSeconds

    const encodedHeader = base64UrlEncodeText(JSON.stringify(parsedHeader))
    const encodedPayload = base64UrlEncodeText(JSON.stringify(parsedPayload))
    const encodedSignature = await signJwtHmac(
      `${encodedHeader}.${encodedPayload}`,
      secret,
      algorithm
    )

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
  } catch {
    return 'Invalid JSON in header or payload'
  }
}

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export function useTokenGenerator() {
  const [tokenType, setTokenType] = useState<TokenType>('uuid')
  const [config, setConfig] = useState<TokenConfig>(DEFAULT_CONFIG)
  const [results, setResults] = useState<string[]>([])
  const [toast, setToast] = useState('')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 1500)
  }, [])

  const updateConfig = useCallback(
    <T extends TokenType>(
      type: T,
      key: keyof TokenConfig[T],
      value: TokenConfig[T][keyof TokenConfig[T]]
    ) => {
      setConfig((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          [key]: value
        }
      }))
    },
    []
  )

  const generate = useCallback(async () => {
    let generated: string[] = []

    switch (tokenType) {
      case 'uuid':
        generated = Array.from({ length: config.uuid.count }, () => generateUUID())
        break

      case 'jwt':
        generated = [
          await generateJWT(
            config.jwt.header,
            config.jwt.payload,
            config.jwt.secret,
            config.jwt.expiration
          )
        ]
        break

      case 'api-key':
        generated = [generateApiKey(config['api-key'].prefix, config['api-key'].length)]
        break

      case 'random-string':
        generated = [
          generateRandomString(config['random-string'].length, config['random-string'].charset)
        ]
        break

      case 'secret-key':
        generated = [generateSecretKey(config['secret-key'].length)]
        break
    }

    setResults(generated)
  }, [tokenType, config])

  const handleCopy = useCallback(
    (text: string, index: number) => {
      navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      showToast('已复制到剪贴板')
      setTimeout(() => setCopiedIndex(null), 1500)
    },
    [showToast]
  )

  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(results.join('\n'))
    showToast('已复制全部结果')
  }, [results, showToast])

  const handleExport = useCallback(
    (format: 'txt' | 'json') => {
      let content = ''
      if (format === 'txt') {
        content = results.join('\n')
      } else {
        content = JSON.stringify(results, null, 2)
      }

      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tokens.${format}`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`已导出 ${format.toUpperCase()} 文件`)
    },
    [results, showToast]
  )

  return {
    tokenType,
    setTokenType,
    config,
    updateConfig,
    results,
    toast,
    copiedIndex,
    generate,
    handleCopy,
    handleCopyAll,
    handleExport
  }
}
