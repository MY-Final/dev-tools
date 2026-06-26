import { useState, useCallback } from 'react'
import { KeyRound, Copy, Check, Loader2 } from 'lucide-react'
import '../styles/ssh-key-generator.css'

type KeyType = 'RSA' | 'Ed25519'
type RsaBits = 2048 | 4096

interface KeyPair {
  publicKey: string // OpenSSH format
  privateKey: string // PKCS#8 PEM
  fingerprint: string // SHA-256
}

// ── Helpers ────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function encodeString(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function encodeUint32(n: number): Uint8Array {
  const bytes = new Uint8Array(4)
  bytes[0] = (n >>> 24) & 0xff
  bytes[1] = (n >>> 16) & 0xff
  bytes[2] = (n >>> 8) & 0xff
  bytes[3] = n & 0xff
  return bytes
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

// Parse SPKI DER to extract raw key bytes
function parseSpkiForEd25519(spkiDer: ArrayBuffer): Uint8Array {
  // SPKI for Ed25519: SEQUENCE { SEQUENCE { OID 1.3.101.112 } BIT STRING (32 bytes) }
  // The last 32 bytes of the BIT STRING value (skip unused bits byte)
  const bytes = new Uint8Array(spkiDer)
  // Find the BIT STRING (tag 0x03) - it should be the last element
  for (let i = bytes.length - 34; i >= 0; i--) {
    if (bytes[i] === 0x03 && bytes[i + 1] === 0x21 && bytes[i + 2] === 0x00) {
      return bytes.slice(i + 3, i + 35) // 32 bytes of public key
    }
  }
  throw new Error('无法解析 Ed25519 公钥')
}

// Parse SPKI DER to extract RSA modulus and exponent
function parseSpkiForRsa(spkiDer: ArrayBuffer): { modulus: Uint8Array; exponent: Uint8Array } {
  const bytes = new Uint8Array(spkiDer)
  // Find the BIT STRING containing the RSA public key
  let bitStringOffset = -1
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x03) {
      // BIT STRING tag
      const len = bytes[i + 1]
      if (len > 0 && bytes[i + 2] === 0x00) {
        // unused bits = 0
        bitStringOffset = i + 3
        break
      }
    }
  }
  if (bitStringOffset < 0) throw new Error('无法解析 RSA 公钥')

  // Inside the BIT STRING is a SEQUENCE of two INTEGERs
  const rsaBytes = bytes.slice(bitStringOffset)
  if (rsaBytes[0] !== 0x30) throw new Error('无效的 RSA 公钥格式')

  // Parse SEQUENCE
  let pos = 2 // skip SEQUENCE tag + length byte (assuming length < 128)
  if (rsaBytes[1] & 0x80) {
    const lenBytes = rsaBytes[1] & 0x7f
    pos = 2 + lenBytes
  }

  // Parse modulus INTEGER
  if (rsaBytes[pos] !== 0x02) throw new Error('无效的 RSA 模数')
  pos++
  let modLen = rsaBytes[pos]
  pos++
  if (modLen & 0x80) {
    const lenBytes = modLen & 0x7f
    modLen = 0
    for (let j = 0; j < lenBytes; j++) modLen = (modLen << 8) | rsaBytes[pos + j]
    pos += lenBytes
  }
  // Skip leading zero byte if present (positive integer encoding)
  const modStart = rsaBytes[pos] === 0x00 ? pos + 1 : pos
  const modulus = rsaBytes.slice(modStart, pos + modLen)
  pos += modLen

  // Parse exponent INTEGER
  if (rsaBytes[pos] !== 0x02) throw new Error('无效的 RSA 指数')
  pos++
  let expLen = rsaBytes[pos]
  pos++
  if (expLen & 0x80) {
    const lenBytes = expLen & 0x7f
    expLen = 0
    for (let j = 0; j < lenBytes; j++) expLen = (expLen << 8) | rsaBytes[pos + j]
    pos += lenBytes
  }
  const exponent = rsaBytes.slice(pos, pos + expLen)

  return { modulus, exponent }
}

// Build RSA OpenSSH public key blob
function buildRsaOpenSSHBlob(modulus: Uint8Array, exponent: Uint8Array): Uint8Array {
  const typeStr = 'ssh-rsa'
  const typeBytes = encodeString(typeStr)
  return concatBytes(
    encodeUint32(typeBytes.length),
    typeBytes,
    encodeUint32(exponent.length),
    exponent,
    encodeUint32(modulus.length),
    modulus
  )
}

// Convert ArrayBuffer to PEM
function arrayBufferToPem(buffer: ArrayBuffer, label: string): string {
  const b64 = arrayBufferToBase64(buffer)
  const lines = b64.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

// Calculate SHA-256 fingerprint
async function calculateFingerprint(blob: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', blob.buffer as ArrayBuffer)
  const bytes = new Uint8Array(hash)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return `SHA256:${btoa(binary)}`
}

// ── Key Generation ─────────────────────────────────────────────

async function generateRsaKeyPair(bits: RsaBits, comment: string): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: bits,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  )

  // Export public key in SPKI format
  const spkiDer = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const { modulus, exponent } = parseSpkiForRsa(spkiDer)

  // Build OpenSSH public key
  const sshBlob = buildRsaOpenSSHBlob(modulus, exponent)
  const b64 = uint8ToBase64(sshBlob)
  const publicKey = `ssh-rsa ${b64} ${comment}`

  // Export private key in PKCS#8 PEM
  const pkcs8Der = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const privateKey = arrayBufferToPem(pkcs8Der, 'PRIVATE KEY')

  // Fingerprint
  const fingerprint = await calculateFingerprint(sshBlob)

  return { publicKey, privateKey, fingerprint }
}

async function generateEd25519KeyPair(comment: string): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])

  // Export public key in SPKI format
  const spkiDer = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const rawPublicKey = parseSpkiForEd25519(spkiDer)

  // Build OpenSSH public key
  const typeStr = 'ssh-ed25519'
  const typeBytes = encodeString(typeStr)
  const sshBlob = concatBytes(
    encodeUint32(typeBytes.length),
    typeBytes,
    encodeUint32(rawPublicKey.length),
    rawPublicKey
  )
  const b64 = uint8ToBase64(sshBlob)
  const publicKey = `${typeStr} ${b64} ${comment}`

  // Export private key in PKCS#8 PEM
  const pkcs8Der = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const privateKey = arrayBufferToPem(pkcs8Der, 'PRIVATE KEY')

  // Fingerprint
  const fingerprint = await calculateFingerprint(sshBlob)

  return { publicKey, privateKey, fingerprint }
}

// ── Component ──────────────────────────────────────────────────

export default function SshKeyGenerator(): React.JSX.Element {
  const [keyType, setKeyType] = useState<KeyType>('Ed25519')
  const [rsaBits, setRsaBits] = useState<RsaBits>(2048)
  const [comment, setComment] = useState('')
  const [generating, setGenerating] = useState(false)
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null)
  const [error, setError] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showPrivateKey, setShowPrivateKey] = useState(false)

  const generate = useCallback(async () => {
    setGenerating(true)
    setError('')
    setKeyPair(null)

    try {
      const userComment = comment || `${navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || 'browser'}@${window.location.hostname || 'localhost'}`
      const result =
        keyType === 'RSA'
          ? await generateRsaKeyPair(rsaBits, userComment)
          : await generateEd25519KeyPair(userComment)
      setKeyPair(result)
      setShowPrivateKey(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '密钥生成失败')
    } finally {
      setGenerating(false)
    }
  }, [keyType, rsaBits, comment])

  const copyField = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(key)
      setTimeout(() => setCopiedField(null), 1500)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <div className="skg-page">
      <div className="skg-card">
        <div className="skg-header">
          <h2 className="skg-title">SSH Key Generator</h2>
          <p className="skg-subtitle">生成 Ed25519/RSA 密钥对</p>
        </div>

        {/* Key type selector */}
        <div className="skg-row">
          <div className="skg-selector-group">
            <span className="skg-label">算法</span>
            <div className="skg-selector">
              {(['Ed25519', 'RSA'] as KeyType[]).map((t) => (
                <button
                  key={t}
                  className={`skg-selector-btn ${keyType === t ? 'active' : ''}`}
                  onClick={() => setKeyType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {keyType === 'RSA' && (
            <div className="skg-selector-group">
              <span className="skg-label">密钥长度</span>
              <div className="skg-selector">
                {([2048, 4096] as RsaBits[]).map((bits) => (
                  <button
                    key={bits}
                    className={`skg-selector-btn ${rsaBits === bits ? 'active' : ''}`}
                    onClick={() => setRsaBits(bits)}
                  >
                    {bits} bits
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comment input */}
        <div className="skg-input-area">
          <div className="skg-input-header">
            <span className="skg-input-label">注释 (Comment)</span>
          </div>
          <input
            className="skg-input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="user@host (可选)"
          />
        </div>

        {/* Generate button */}
        <button className="skg-generate-btn" onClick={generate} disabled={generating}>
          {generating ? (
            <>
              <Loader2 size={16} className="skg-spin" />
              生成中...
            </>
          ) : (
            <>
              <KeyRound size={16} />
              生成密钥对
            </>
          )}
        </button>

        {/* Error */}
        {error && <div className="skg-error">{error}</div>}

        {/* Key pair result */}
        {keyPair && (
          <div className="skg-result">
            {/* Fingerprint */}
            <div className="skg-section">
              <div className="skg-section-header">
                <span className="skg-section-title">
                  <KeyRound size={14} />
                  指纹 (Fingerprint)
                </span>
                <button
                  className="skg-copy-btn"
                  onClick={() => copyField('fingerprint', keyPair.fingerprint)}
                >
                  {copiedField === 'fingerprint' ? (
                    <Check size={13} />
                  ) : (
                    <Copy size={13} />
                  )}
                  {copiedField === 'fingerprint' ? '已复制' : '复制'}
                </button>
              </div>
              <div className="skg-fingerprint">{keyPair.fingerprint}</div>
            </div>

            {/* Public key */}
            <div className="skg-section">
              <div className="skg-section-header">
                <span className="skg-section-title">
                  <KeyRound size={14} />
                  公钥 (OpenSSH 格式)
                </span>
                <button
                  className="skg-copy-btn"
                  onClick={() => copyField('public', keyPair.publicKey)}
                >
                  {copiedField === 'public' ? <Check size={13} /> : <Copy size={13} />}
                  {copiedField === 'public' ? '已复制' : '复制'}
                </button>
              </div>
              <div className="skg-key-content">{keyPair.publicKey}</div>
            </div>

            {/* Private key */}
            <div className="skg-section">
              <div className="skg-section-header">
                <span className="skg-section-title">
                  <KeyRound size={14} />
                  私钥 (PKCS#8 PEM 格式)
                </span>
                <div className="skg-private-actions">
                  <button
                    className="skg-toggle-btn"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                  >
                    {showPrivateKey ? '隐藏' : '显示'}
                  </button>
                  <button
                    className="skg-copy-btn"
                    onClick={() => copyField('private', keyPair.privateKey)}
                  >
                    {copiedField === 'private' ? <Check size={13} /> : <Copy size={13} />}
                    {copiedField === 'private' ? '已复制' : '复制'}
                  </button>
                </div>
              </div>
              {showPrivateKey ? (
                <div className="skg-key-content skg-private">{keyPair.privateKey}</div>
              ) : (
                <div className="skg-private-hidden">
                  🔒 点击「显示」查看私钥内容
                </div>
              )}
            </div>

            {/* Warning */}
            <div className="skg-warning">
              ⚠️ 请妥善保管私钥，不要分享给他人。建议设置文件权限为 600。
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
