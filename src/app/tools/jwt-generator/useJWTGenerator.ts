import { useState, useCallback, useMemo } from 'react'

export type Algorithm = 'HS256' | 'HS384' | 'HS512'

export type Expiration = '15m' | '1h' | '12h' | '1d' | '7d' | '30d'

export type RoleTemplate = 'admin' | 'user' | 'guest'

export type ClaimField = 'sub' | 'exp' | 'iat' | 'aud' | 'iss' | 'jti'

const DEFAULT_HEADER = {
  alg: 'HS256' as Algorithm,
  typ: 'JWT'
}

const DEFAULT_PAYLOAD = {
  sub: '10001',
  name: 'test-user',
  role: 'admin'
}

const ROLE_TEMPLATES: Record<RoleTemplate, Record<string, string>> = {
  admin: { role: 'admin' },
  user: { role: 'user' },
  guest: { role: 'guest' }
}

const PAYLOAD_TEMPLATES = {
  'user-login': {
    sub: '10001',
    name: 'John Doe',
    role: 'user'
  },
  'admin-login': {
    sub: '1',
    role: 'admin'
  },
  'api-access': {
    scope: '["read", "write"]'
  }
}

const RANDOM_FIELDS = {
  userId: () => `u_${Math.floor(100000 + Math.random() * 900000)}`,
  username: () => {
    const names = ['alice', 'bob', 'charlie', 'david', 'eve', 'frank', 'grace']
    return names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100)
  },
  email: () => {
    const num = Math.floor(100000 + Math.random() * 900000)
    return `test${num}@example.com`
  },
  role: () => {
    const roles = ['admin', 'user', 'editor', 'viewer']
    return roles[Math.floor(Math.random() * roles.length)]
  },
  tenantId: () => `tenant_${Math.floor(1000 + Math.random() * 9000)}`,
  permissions: () => {
    const perms = ['read', 'write', 'delete', 'admin']
    const count = 1 + Math.floor(Math.random() * 3)
    const selected: string[] = []
    for (let i = 0; i < count; i++) {
      selected.push(perms[Math.floor(Math.random() * perms.length)])
    }
    return JSON.stringify([...new Set(selected)])
  }
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return atob(s)
}

function simpleSign(message: string, secret: string, algorithm: Algorithm): string {
  let hash = 0
  const combined = message + secret + algorithm
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }

  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  const repeatCount = algorithm === 'HS256' ? 4 : algorithm === 'HS384' ? 6 : 8
  return hex.repeat(repeatCount)
}

function getExpirationSeconds(expiration: Expiration): number {
  switch (expiration) {
    case '15m':
      return 900
    case '1h':
      return 3600
    case '12h':
      return 43200
    case '1d':
      return 86400
    case '7d':
      return 604800
    case '30d':
      return 2592000
    default:
      return 3600
  }
}

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export function useJWTGenerator() {
  const [headerJson, setHeaderJson] = useState(JSON.stringify(DEFAULT_HEADER, null, 2))
  const [payloadJson, setPayloadJson] = useState(JSON.stringify(DEFAULT_PAYLOAD, null, 2))
  const [secret, setSecret] = useState('my-secret-key')
  const [showSecret, setShowSecret] = useState(false)
  const [algorithm, setAlgorithm] = useState<Algorithm>('HS256')
  const [expiration, setExpiration] = useState<Expiration>('1h')
  const [toast, setToast] = useState('')

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 1500)
  }, [])

  // Validate JSON during render (not in effects)
  const headerError = useMemo(() => {
    try {
      JSON.parse(headerJson)
      return ''
    } catch {
      return 'Invalid JSON'
    }
  }, [headerJson])

  const payloadError = useMemo(() => {
    try {
      JSON.parse(payloadJson)
      return ''
    } catch {
      return 'Invalid JSON'
    }
  }, [payloadJson])

  const jwt = useMemo(() => {
    if (headerError || payloadError) return ''

    try {
      const header = JSON.parse(headerJson)
      const payload = JSON.parse(payloadJson)

      // eslint-disable-next-line react-hooks/purity
      const now = Math.floor(Date.now() / 1000)
      payload.iat = now
      payload.exp = now + getExpirationSeconds(expiration)

      const encodedHeader = base64UrlEncode(JSON.stringify(header))
      const encodedPayload = base64UrlEncode(JSON.stringify(payload))
      const signature = simpleSign(`${encodedHeader}.${encodedPayload}`, secret, algorithm)
      const encodedSignature = base64UrlEncode(signature)

      return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
    } catch {
      return ''
    }
  }, [headerJson, payloadJson, secret, algorithm, expiration, headerError, payloadError])

  const jwtParts = useMemo(() => {
    if (!jwt) return null

    const parts = jwt.split('.')
    if (parts.length !== 3) return null

    try {
      return {
        header: JSON.stringify(JSON.parse(base64UrlDecode(parts[0])), null, 2),
        payload: JSON.stringify(JSON.parse(base64UrlDecode(parts[1])), null, 2),
        signature: parts[2]
      }
    } catch {
      return null
    }
  }, [jwt])

  const updateAlgorithm = useCallback(
    (alg: Algorithm) => {
      setAlgorithm(alg)
      try {
        const header = JSON.parse(headerJson)
        header.alg = alg
        setHeaderJson(JSON.stringify(header, null, 2))
      } catch {
        // ignore
      }
    },
    [headerJson]
  )

  const updateExpiration = useCallback((exp: Expiration) => {
    setExpiration(exp)
  }, [])

  const addClaim = useCallback(
    (claim: ClaimField) => {
      try {
        const payload = JSON.parse(payloadJson)
        const now = Math.floor(Date.now() / 1000)

        switch (claim) {
          case 'sub':
            payload.sub = payload.sub || '10001'
            break
          case 'exp':
            payload.exp = now + getExpirationSeconds(expiration)
            break
          case 'iat':
            payload.iat = now
            break
          case 'aud':
            payload.aud = 'your-audience'
            break
          case 'iss':
            payload.iss = 'your-issuer'
            break
          case 'jti':
            payload.jti = crypto.randomUUID()
            break
        }

        setPayloadJson(JSON.stringify(payload, null, 2))
      } catch {
        // ignore
      }
    },
    [payloadJson, expiration]
  )

  const applyRoleTemplate = useCallback(
    (role: RoleTemplate) => {
      try {
        const payload = JSON.parse(payloadJson)
        const template = ROLE_TEMPLATES[role]
        Object.assign(payload, template)
        setPayloadJson(JSON.stringify(payload, null, 2))
      } catch {
        // ignore
      }
    },
    [payloadJson]
  )

  const applyPayloadTemplate = useCallback(
    (template: keyof typeof PAYLOAD_TEMPLATES) => {
      const now = Math.floor(Date.now() / 1000)
      const payload = {
        ...PAYLOAD_TEMPLATES[template],
        iat: now,
        exp: now + getExpirationSeconds(expiration)
      }
      setPayloadJson(JSON.stringify(payload, null, 2))
    },
    [expiration]
  )

  const generateRandomPayload = useCallback(() => {
    const now = Math.floor(Date.now() / 1000)
    const payload: Record<string, string | number> = {
      userId: RANDOM_FIELDS.userId(),
      email: RANDOM_FIELDS.email(),
      role: RANDOM_FIELDS.role(),
      status: 'active',
      iat: now,
      exp: now + getExpirationSeconds(expiration)
    }
    setPayloadJson(JSON.stringify(payload, null, 2))
  }, [expiration])

  const generateRandomSecret = useCallback(
    (length: 32 | 64 | 128 = 32) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let result = ''
      const array = new Uint32Array(length)
      crypto.getRandomValues(array)
      for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length]
      }
      setSecret(result)
      showToast('Secret 已生成')
    },
    [showToast]
  )

  const copyJWT = useCallback(() => {
    if (jwt) {
      navigator.clipboard.writeText(jwt)
      showToast('已复制到剪贴板')
    }
  }, [jwt, showToast])

  return {
    headerJson,
    setHeaderJson,
    payloadJson,
    setPayloadJson,
    secret,
    setSecret,
    showSecret,
    setShowSecret,
    algorithm,
    expiration,
    jwt,
    jwtParts,
    toast,
    headerError,
    payloadError,
    updateAlgorithm,
    updateExpiration,
    addClaim,
    applyRoleTemplate,
    applyPayloadTemplate,
    generateRandomPayload,
    generateRandomSecret,
    copyJWT
  }
}
