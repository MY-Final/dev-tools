export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function hexToBytes(input: string): Uint8Array {
  const hex = input.replace(/\s/g, '')
  if (hex.length % 2 !== 0) throw new Error('Hex 长度必须为偶数')
  if (!/^[0-9a-f]*$/i.test(hex)) throw new Error('无效的 Hex 字符')
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlEncodeText(text: string): string {
  return base64UrlEncode(new TextEncoder().encode(text))
}

export type JwtHmacAlgorithm = 'HS256' | 'HS384' | 'HS512'

const JWT_HMAC_HASHES: Record<JwtHmacAlgorithm, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512'
}

export async function signJwtHmac(
  message: string,
  secret: string,
  algorithm: JwtHmacAlgorithm
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(secret)),
    { name: 'HMAC', hash: JWT_HMAC_HASHES[algorithm] },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    toArrayBuffer(new TextEncoder().encode(message))
  )
  return base64UrlEncode(new Uint8Array(signature))
}
export function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function base64UrlDecodeText(input: string): string {
  return new TextDecoder().decode(base64UrlDecode(input))
}

export function randomBytes(length: number): Uint8Array {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new Error('随机字节长度无效')
  }
  const bytes = new Uint8Array(length)
  const chunkSize = 0x10000
  for (let offset = 0; offset < length; offset += chunkSize) {
    crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + chunkSize, length)))
  }
  return bytes
}

export function randomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 0x100000000) {
    throw new Error('随机数范围无效')
  }

  const range = 0x100000000
  const limit = Math.floor(range / maxExclusive) * maxExclusive
  const buffer = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)

  return value % maxExclusive
}

export function randomString(length: number, alphabet: string): string {
  if (!alphabet) throw new Error('字符集不能为空')
  let result = ''
  for (let i = 0; i < length; i++) result += alphabet[randomInt(alphabet.length)]
  return result
}

export async function aesGcmEncrypt(
  data: Uint8Array,
  keyBytes: Uint8Array,
  iv: Uint8Array
): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    'AES-GCM',
    false,
    ['encrypt']
  )
  const result = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv), tagLength: 128 },
      key,
      toArrayBuffer(data)
    )
  )

  return {
    ciphertext: result.slice(0, -16),
    tag: result.slice(-16)
  }
}

export async function aesGcmDecrypt(
  data: Uint8Array,
  keyBytes: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  if (data.length <= 16) throw new Error('GCM 密文必须包含 16 字节 Auth Tag')

  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    'AES-GCM',
    false,
    ['decrypt']
  )
  const result = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv), tagLength: 128 },
    key,
    toArrayBuffer(data)
  )
  return new Uint8Array(result)
}
function leftRotate(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0
}

const MD5_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20,
  5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
]

const MD5_CONSTANTS = Array.from(
  { length: 64 },
  (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0
)

export function md5(data: Uint8Array): Uint8Array {
  const bitLength = data.length * 8
  const paddedLength = Math.ceil((data.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(data)
  padded[data.length] = 0x80

  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, bitLength >>> 0, true)
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) =>
      view.getUint32(offset + index * 4, true)
    )
    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let i = 0; i < 64; i++) {
      let f = 0
      let g = 0
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }

      const sum = (a + f + MD5_CONSTANTS[i] + words[g]) >>> 0
      const nextB = (b + leftRotate(sum, MD5_SHIFTS[i])) >>> 0
      a = d
      d = c
      c = b
      b = nextB
    }

    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  const digest = new Uint8Array(16)
  const digestView = new DataView(digest.buffer)
  digestView.setUint32(0, a0, true)
  digestView.setUint32(4, b0, true)
  digestView.setUint32(8, c0, true)
  digestView.setUint32(12, d0, true)
  return digest
}

export function md5Hex(data: Uint8Array): string {
  return bytesToHex(md5(data))
}
