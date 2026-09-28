import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  base64UrlDecodeText,
  base64UrlEncodeText,
  randomInt,
  randomString,
  signJwtHmac
} from '@renderer/lib/crypto-utils'

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
  userId: () => `u_${100000 + randomInt(900000)}`,
  username: () => {
    const names = ['alice', 'bob', 'charlie', 'david', 'eve', 'frank', 'grace']
    return names[randomInt(names.length)] + randomInt(100)
  },
  email: () => {
    const num = 100000 + randomInt(900000)
    return `test${num}@example.com`
  },
  role: () => {
    const roles = ['admin', 'user', 'editor', 'viewer']
    return roles[randomInt(roles.length)]
  },
  tenantId: () => `tenant_${1000 + randomInt(9000)}`,
  permissions: () => {
    const perms = ['read', 'write', 'delete', 'admin']
    const count = 1 + randomInt(3)
    const selected: string[] = []
    for (let i = 0; i < count; i++) {
      selected.push(perms[randomInt(perms.length)])
    }
    return JSON.stringify([...new Set(selected)])
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export function useJWTGenerator() {
  const [headerJson, setHeaderJson] = useState(JSON.stringify(DEFAULT_HEADER, null, 2))
  const [payloadJson, setPayloadJson] = useState(JSON.stringify(DEFAULT_PAYLOAD, null, 2))
  const [secret, setSecret] = useState('my-secret-key')
  const [showSecret, setShowSecret] = useState(false)
  const [algorithm, setAlgorithm] = useState<Algorithm>('HS256')
  const [expiration, setExpiration] = useState<Expiration>('1h')
  const [signedJwt, setSignedJwt] = useState<{ key: string; token: string }>({ key: '', token: '' })
  const [toast, setToast] = useState('')

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 1500)
  }, [])

  // Validate JSON during render (not in effects)
  const headerError = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(headerJson)
      return isRecord(parsed) ? '' : 'Header must be a JSON object'
    } catch {
      return 'Invalid JSON'
    }
  }, [headerJson])

  const payloadError = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(payloadJson)
      return isRecord(parsed) ? '' : 'Payload must be a JSON object'
    } catch {
      return 'Invalid JSON'
    }
  }, [payloadJson])

  const generationKey = useMemo(
    () => JSON.stringify({ headerJson, payloadJson, secret, algorithm, expiration }),
    [headerJson, payloadJson, secret, algorithm, expiration]
  )

  useEffect(() => {
    if (headerError || payloadError) return

    let cancelled = false

    const generate = async (): Promise<void> => {
      try {
        const header = JSON.parse(headerJson) as Record<string, unknown>
        const payload = JSON.parse(payloadJson) as Record<string, unknown>
        const now = Math.floor(Date.now() / 1000)

        header.alg = algorithm
        payload.iat = now
        payload.exp = now + getExpirationSeconds(expiration)

        const encodedHeader = base64UrlEncodeText(JSON.stringify(header))
        const encodedPayload = base64UrlEncodeText(JSON.stringify(payload))
        const encodedSignature = await signJwtHmac(
          `${encodedHeader}.${encodedPayload}`,
          secret,
          algorithm
        )

        if (!cancelled) {
          setSignedJwt({
            key: generationKey,
            token: `${encodedHeader}.${encodedPayload}.${encodedSignature}`
          })
        }      } catch {
        if (!cancelled) setSignedJwt({ key: generationKey, token: '' })
      }
    }

    void generate()
    return () => {
      cancelled = true
    }
  }, [generationKey, headerJson, payloadJson, secret, algorithm, expiration, headerError, payloadError])

  const jwt = useMemo(
    () =>
      !headerError && !payloadError && signedJwt.key === generationKey ? signedJwt.token : '',
    [headerError, payloadError, signedJwt, generationKey]
  )
  const jwtParts = useMemo(() => {
    if (!jwt) return null

    const parts = jwt.split('.')
    if (parts.length !== 3) return null

    try {
      return {
        header: JSON.stringify(JSON.parse(base64UrlDecodeText(parts[0])), null, 2),
        payload: JSON.stringify(JSON.parse(base64UrlDecodeText(parts[1])), null, 2),
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
        const header = JSON.parse(headerJson) as Record<string, unknown>
        header.alg = alg
        setHeaderJson(JSON.stringify(header, null, 2))
      } catch {
        // Ignore invalid JSON until the user fixes it.
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
        const payload = JSON.parse(payloadJson) as Record<string, unknown>
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
        // Ignore invalid JSON until the user fixes it.
      }
    },
    [payloadJson, expiration]
  )

  const applyRoleTemplate = useCallback(
    (role: RoleTemplate) => {
      try {
        const payload = JSON.parse(payloadJson) as Record<string, unknown>
        const template = ROLE_TEMPLATES[role]
        Object.assign(payload, template)
        setPayloadJson(JSON.stringify(payload, null, 2))
      } catch {
        // Ignore invalid JSON until the user fixes it.
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
      setSecret(randomString(length, chars))
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
