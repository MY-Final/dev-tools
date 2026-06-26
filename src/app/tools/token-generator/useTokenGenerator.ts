import { useState, useCallback } from 'react'

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

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function generateRandomString(length: number, charsets: RandomStringCharset[]): string {
  let chars = ''
  for (const charset of charsets) {
    chars += CHARSET_MAP[charset]
  }
  if (!chars) chars = CHARSET_MAP.lowercase + CHARSET_MAP.digits

  let result = ''
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length]
  }
  return result
}

function generateApiKey(prefix: string, length: number): string {
  const randomPart = generateRandomString(length, ['lowercase', 'digits', 'uppercase'])
  return `${prefix}_${randomPart}`
}

function generateSecretKey(length: number): string {
  return generateRandomString(length, ['uppercase', 'lowercase', 'digits'])
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function simpleSign(message: string, secret: string): string {
  let hash = 0
  const combined = message + secret
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return hex + hex + hex + hex + hex + hex + hex + hex
}

function generateJWT(header: string, payload: string, secret: string, expiration: string): string {
  try {
    const headerObj = JSON.parse(header)
    const payloadObj = JSON.parse(payload)

    const now = Math.floor(Date.now() / 1000)
    let expSeconds = 3600
    if (expiration === '15m') expSeconds = 900
    else if (expiration === '1h') expSeconds = 3600
    else if (expiration === '1d') expSeconds = 86400
    else if (expiration === '7d') expSeconds = 604800
    else if (expiration === '30d') expSeconds = 2592000

    payloadObj.iat = now
    payloadObj.exp = now + expSeconds

    const encodedHeader = base64UrlEncode(JSON.stringify(headerObj))
    const encodedPayload = base64UrlEncode(JSON.stringify(payloadObj))
    const signature = simpleSign(`${encodedHeader}.${encodedPayload}`, secret)
    const encodedSignature = base64UrlEncode(signature)

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

  const generate = useCallback(() => {
    let generated: string[] = []

    switch (tokenType) {
      case 'uuid':
        generated = Array.from({ length: config.uuid.count }, () => generateUUID())
        break

      case 'jwt':
        generated = [
          generateJWT(
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
