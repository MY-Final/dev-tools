import { useState, useCallback } from 'react'
import { Lock, Unlock, Copy, Check, RotateCcw, RefreshCw } from 'lucide-react'
import forge from 'node-forge'
import '../styles/aes-des-encryptor.css'

type CipherType = 'AES' | 'DES' | '3DES'
type AesMode = 'CBC' | 'GCM' | 'CTR' | 'ECB'
type DesMode = 'CBC' | 'ECB'
type InputFormat = 'text' | 'hex' | 'base64'
type OutputFormat = 'hex' | 'base64'
type Action = 'encrypt' | 'decrypt'

const AES_MODES: AesMode[] = ['CBC', 'GCM', 'CTR', 'ECB']
const DES_MODES: DesMode[] = ['CBC', 'ECB']
const AES_KEY_SIZES = [
  { bits: 128, bytes: 16, label: 'AES-128' },
  { bits: 192, bytes: 24, label: 'AES-192' },
  { bits: 256, bytes: 32, label: 'AES-256' }
]

// ── Helpers ────────────────────────────────────────────────────

function parseBytes(input: string, format: InputFormat): Uint8Array {
  if (!input) return new Uint8Array(0)
  switch (format) {
    case 'text':
      return new TextEncoder().encode(input)
    case 'hex': {
      const hex = input.replace(/\s/g, '')
      if (hex.length % 2 !== 0) throw new Error('Hex 长度必须为偶数')
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2) {
        const val = parseInt(hex.substring(i, i + 2), 16)
        if (isNaN(val)) throw new Error(`无效的 Hex 字符: ${hex.substring(i, i + 2)}`)
        bytes[i / 2] = val
      }
      return bytes
    }
    case 'base64': {
      try {
        const binary = atob(input)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return bytes
      } catch {
        throw new Error('无效的 Base64 字符串')
      }
    }
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function formatOutput(bytes: Uint8Array, format: OutputFormat): string {
  return format === 'hex' ? bytesToHex(bytes) : bytesToBase64(bytes)
}

function uint8ToForgeBuffer(bytes: Uint8Array): forge.util.ByteStringBuffer {
  return forge.util.createBuffer(String.fromCharCode(...bytes))
}

function generateRandomHex(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return bytesToHex(bytes)
}

// ── AES via Web Crypto ─────────────────────────────────────────

async function aesEncrypt(
  data: Uint8Array,
  keyBytes: Uint8Array,
  ivBytes: Uint8Array | null,
  mode: AesMode,
  _keySize: number
): Promise<{ ciphertext: Uint8Array; tag?: Uint8Array }> {
  const algoName = mode === 'CTR' ? 'AES-CTR' : mode === 'GCM' ? 'AES-GCM' : 'AES-CBC'

  if (mode === 'ECB') {
    const cipher = forge.cipher.createCipher('AES-ECB', uint8ToForgeBuffer(keyBytes))
    cipher.start()
    cipher.update(uint8ToForgeBuffer(data))
    cipher.finish()
    const out = cipher.output.bytes()
    return { ciphertext: Uint8Array.from(out, (c) => c.charCodeAt(0)) }
  }

  const algoParams: AlgorithmIdentifier | AesCtrParams | AesGcmParams | AesCbcParams =
    mode === 'CTR'
      ? { name: 'AES-CTR', counter: ivBytes!.buffer as ArrayBuffer, length: 64 }
      : mode === 'GCM'
        ? { name: 'AES-GCM', iv: ivBytes!.buffer as ArrayBuffer, tagLength: 128 }
        : { name: 'AES-CBC', iv: ivBytes!.buffer as ArrayBuffer }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    algoName,
    false,
    ['encrypt']
  )
  const result = await crypto.subtle.encrypt(algoParams, cryptoKey, data.buffer as ArrayBuffer)
  const resultBytes = new Uint8Array(result)

  if (mode === 'GCM') {
    const ciphertext = resultBytes.slice(0, -16)
    const tag = resultBytes.slice(-16)
    return { ciphertext, tag }
  }

  return { ciphertext: resultBytes }
}

async function aesDecrypt(
  data: Uint8Array,
  keyBytes: Uint8Array,
  ivBytes: Uint8Array | null,
  mode: AesMode,
  tag?: Uint8Array
): Promise<Uint8Array> {
  const algoName = mode === 'CTR' ? 'AES-CTR' : mode === 'GCM' ? 'AES-GCM' : 'AES-CBC'

  if (mode === 'ECB') {
    const decipher = forge.cipher.createDecipher('AES-ECB', uint8ToForgeBuffer(keyBytes))
    decipher.start()
    decipher.update(uint8ToForgeBuffer(data))
    decipher.finish()
    const out = decipher.output.bytes()
    return Uint8Array.from(out, (c) => c.charCodeAt(0))
  }

  let inputData: BufferSource = data.buffer as ArrayBuffer
  if (mode === 'GCM' && tag) {
    const combined = new Uint8Array(data.length + tag.length)
    combined.set(data)
    combined.set(tag, data.length)
    inputData = combined.buffer as ArrayBuffer
  }

  const algoParams: AlgorithmIdentifier | AesCtrParams | AesGcmParams | AesCbcParams =
    mode === 'CTR'
      ? { name: 'AES-CTR', counter: ivBytes!.buffer as ArrayBuffer, length: 64 }
      : mode === 'GCM'
        ? { name: 'AES-GCM', iv: ivBytes!.buffer as ArrayBuffer, tagLength: 128 }
        : { name: 'AES-CBC', iv: ivBytes!.buffer as ArrayBuffer }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    algoName,
    false,
    ['decrypt']
  )
  const result = await crypto.subtle.decrypt(algoParams, cryptoKey, inputData)
  return new Uint8Array(result)
}

// ── DES/3DES via node-forge ────────────────────────────────────

function desEncrypt(
  data: Uint8Array,
  keyBytes: Uint8Array,
  ivBytes: Uint8Array | null,
  isTriple: boolean
): Uint8Array {
  const algo = isTriple ? '3DES-ECB' : 'DES-ECB'
  const cipherName = isTriple ? '3DES-CBC' : 'DES-CBC'

  const cipher = forge.cipher.createCipher(
    ivBytes ? cipherName : algo,
    uint8ToForgeBuffer(keyBytes)
  )
  cipher.start(ivBytes ? { iv: uint8ToForgeBuffer(ivBytes) } : {})
  cipher.update(uint8ToForgeBuffer(data))
  cipher.finish()
  const out = cipher.output.bytes()
  return Uint8Array.from(out, (c) => c.charCodeAt(0))
}

function desDecrypt(
  data: Uint8Array,
  keyBytes: Uint8Array,
  ivBytes: Uint8Array | null,
  isTriple: boolean
): Uint8Array {
  const algo = isTriple ? '3DES-ECB' : 'DES-ECB'
  const cipherName = isTriple ? '3DES-CBC' : 'DES-CBC'

  const decipher = forge.cipher.createDecipher(
    ivBytes ? cipherName : algo,
    uint8ToForgeBuffer(keyBytes)
  )
  decipher.start(ivBytes ? { iv: uint8ToForgeBuffer(ivBytes) } : {})
  decipher.update(uint8ToForgeBuffer(data))
  decipher.finish()
  const out = decipher.output.bytes()
  return Uint8Array.from(out, (c) => c.charCodeAt(0))
}

// ── Component ──────────────────────────────────────────────────

export default function AesDesEncryptor(): React.JSX.Element {
  const [cipherType, setCipherType] = useState<CipherType>('AES')
  const [aesMode, setAesMode] = useState<AesMode>('CBC')
  const [desMode, setDesMode] = useState<DesMode>('CBC')
  const [aesKeySize, setAesKeySize] = useState(0) // index into AES_KEY_SIZES
  const [action, setAction] = useState<Action>('encrypt')
  const [keyInput, setKeyInput] = useState('')
  const [keyFormat, setKeyFormat] = useState<InputFormat>('text')
  const [ivInput, setIvInput] = useState('')
  const [ivFormat, setIvFormat] = useState<InputFormat>('hex')
  const [inputData, setInputData] = useState('')
  const [inputFormat, setInputFormat] = useState<InputFormat>('text')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('hex')
  const [outputData, setOutputData] = useState('')
  const [outputTag, setOutputTag] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedTag, setCopiedTag] = useState(false)

  const mode = cipherType === 'AES' ? aesMode : desMode
  const needsIv = mode === 'CBC' || mode === 'GCM' || mode === 'CTR'
  const keySizeBytes = cipherType === 'AES' ? AES_KEY_SIZES[aesKeySize].bytes : cipherType === 'DES' ? 8 : 24

  // Auto-generate IV
  const generateIv = useCallback(() => {
    const ivLen = mode === 'GCM' ? 12 : 16
    setIvInput(generateRandomHex(ivLen))
    setIvFormat('hex')
  }, [mode])

  // Auto-generate key
  const generateKey = useCallback(() => {
    setKeyInput(generateRandomHex(keySizeBytes))
    setKeyFormat('hex')
  }, [keySizeBytes])

  // Process encrypt/decrypt
  const process = useCallback(async () => {
    if (!inputData) {
      setError('请输入数据')
      return
    }
    if (!keyInput) {
      setError('请输入密钥')
      return
    }
    if (needsIv && !ivInput) {
      setError(`${mode} 模式需要 IV`)
      return
    }

    try {
      const keyBytes = parseBytes(keyInput, keyFormat)
      if (keyBytes.length !== keySizeBytes) {
        setError(`密钥长度必须为 ${keySizeBytes} 字节 (${keySizeBytes * 8} bits)，当前为 ${keyBytes.length} 字节`)
        return
      }

      let ivBytes: Uint8Array | null = null
      if (needsIv) {
        ivBytes = parseBytes(ivInput, ivFormat)
        const expectedIvLen = mode === 'GCM' ? 12 : 16
        if (ivBytes.length !== expectedIvLen) {
          setError(`IV 长度必须为 ${expectedIvLen} 字节，当前为 ${ivBytes.length} 字节`)
          return
        }
      }

      setError('')
      setOutputTag('')

      if (cipherType === 'AES') {
        if (action === 'encrypt') {
          const dataBytes = parseBytes(inputData, inputFormat)
          const result = await aesEncrypt(dataBytes, keyBytes, ivBytes, aesMode, AES_KEY_SIZES[aesKeySize].bits)
          setOutputData(formatOutput(result.ciphertext, outputFormat))
          if (result.tag) setOutputTag(bytesToHex(result.tag))
        } else {
          const dataBytes = parseBytes(inputData, inputFormat)
          const result = await aesDecrypt(dataBytes, keyBytes, ivBytes, aesMode)
          setOutputData(new TextDecoder().decode(result))
        }
      } else {
        const isTriple = cipherType === '3DES'
        if (action === 'encrypt') {
          const dataBytes = parseBytes(inputData, inputFormat)
          const result = desEncrypt(dataBytes, keyBytes, ivBytes, isTriple)
          setOutputData(formatOutput(result, outputFormat))
        } else {
          const dataBytes = parseBytes(inputData, inputFormat)
          const result = desDecrypt(dataBytes, keyBytes, ivBytes, isTriple)
          setOutputData(new TextDecoder().decode(result))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败')
      setOutputData('')
      setOutputTag('')
    }
  }, [inputData, inputFormat, keyInput, keyFormat, ivInput, ivFormat, cipherType, aesMode, desMode, aesKeySize, action, outputFormat, needsIv, mode, keySizeBytes])

  const copyOutput = useCallback(async () => {
    if (!outputData) return
    try {
      await navigator.clipboard.writeText(outputData)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }, [outputData])

  const copyTag = useCallback(async () => {
    if (!outputTag) return
    try {
      await navigator.clipboard.writeText(outputTag)
      setCopiedTag(true)
      setTimeout(() => setCopiedTag(false), 1500)
    } catch {
      /* ignore */
    }
  }, [outputTag])

  const clear = useCallback(() => {
    setKeyInput('')
    setIvInput('')
    setInputData('')
    setOutputData('')
    setOutputTag('')
    setError('')
  }, [])

  return (
    <div className="ade-page">
      <div className="ade-card">
        <div className="ade-header">
          <h2 className="ade-title">AES/DES Encryptor</h2>
          <p className="ade-subtitle">对称加密/解密，支持多种算法和模式</p>
        </div>

        {/* Cipher type selector */}
        <div className="ade-row">
          <div className="ade-selector-group">
            <span className="ade-label">算法</span>
            <div className="ade-selector">
              {(['AES', 'DES', '3DES'] as CipherType[]).map((t) => (
                <button
                  key={t}
                  className={`ade-selector-btn ${cipherType === t ? 'active' : ''}`}
                  onClick={() => setCipherType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="ade-selector-group">
            <span className="ade-label">模式</span>
            <div className="ade-selector">
              {(cipherType === 'AES' ? AES_MODES : DES_MODES).map((m) => (
                <button
                  key={m}
                  className={`ade-selector-btn ${mode === m ? 'active' : ''}`}
                  onClick={() =>
                    cipherType === 'AES' ? setAesMode(m as AesMode) : setDesMode(m as DesMode)
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AES key size */}
        {cipherType === 'AES' && (
          <div className="ade-row">
            <div className="ade-selector-group">
              <span className="ade-label">密钥长度</span>
              <div className="ade-selector">
                {AES_KEY_SIZES.map((s, i) => (
                  <button
                    key={s.bits}
                    className={`ade-selector-btn ${aesKeySize === i ? 'active' : ''}`}
                    onClick={() => setAesKeySize(i)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Key input */}
        <div className="ade-input-area">
          <div className="ade-input-header">
            <span className="ade-input-label">
              密钥 (Key) — {keySizeBytes} 字节 / {keySizeBytes * 8} bits
            </span>
            <div className="ade-format-group">
              {(['text', 'hex', 'base64'] as InputFormat[]).map((f) => (
                <button
                  key={f}
                  className={`ade-format-btn ${keyFormat === f ? 'active' : ''}`}
                  onClick={() => setKeyFormat(f)}
                >
                  {f === 'text' ? '文本' : f.toUpperCase()}
                </button>
              ))}
              <button className="ade-gen-btn" onClick={generateKey} title="自动生成密钥">
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
          <input
            className="ade-input"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={`输入 ${keySizeBytes} 字节密钥...`}
          />
        </div>

        {/* IV input */}
        {needsIv && (
          <div className="ade-input-area">
            <div className="ade-input-header">
              <span className="ade-input-label">
                IV / Nonce — {mode === 'GCM' ? '12' : '16'} 字节
              </span>
              <div className="ade-format-group">
                {(['hex', 'base64'] as InputFormat[]).map((f) => (
                  <button
                    key={f}
                    className={`ade-format-btn ${ivFormat === f ? 'active' : ''}`}
                    onClick={() => setIvFormat(f)}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
                <button className="ade-gen-btn" onClick={generateIv} title="自动生成 IV">
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
            <input
              className="ade-input"
              value={ivInput}
              onChange={(e) => setIvInput(e.target.value)}
              placeholder={`输入 ${mode === 'GCM' ? '12' : '16'} 字节 IV...`}
            />
          </div>
        )}

        {/* Input data */}
        <div className="ade-input-area">
          <div className="ade-input-header">
            <span className="ade-input-label">
              {action === 'encrypt' ? '明文输入' : '密文输入'}
            </span>
            <div className="ade-format-group">
              {(['text', 'hex', 'base64'] as InputFormat[]).map((f) => (
                <button
                  key={f}
                  className={`ade-format-btn ${inputFormat === f ? 'active' : ''}`}
                  onClick={() => setInputFormat(f)}
                >
                  {f === 'text' ? '文本' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="ade-textarea"
            value={inputData}
            onChange={(e) => setInputData(e.target.value)}
            placeholder={action === 'encrypt' ? '输入要加密的文本...' : '输入要解密的密文...'}
            rows={4}
          />
        </div>

        {/* Action buttons */}
        <div className="ade-actions">
          <button
            className={`ade-action-btn ${action === 'encrypt' ? 'active encrypt' : ''}`}
            onClick={() => setAction('encrypt')}
          >
            <Lock size={14} />
            加密
          </button>
          <button
            className={`ade-action-btn ${action === 'decrypt' ? 'active decrypt' : ''}`}
            onClick={() => setAction('decrypt')}
          >
            <Unlock size={14} />
            解密
          </button>
          <div className="ade-output-format">
            <span className="ade-label">输出:</span>
            <div className="ade-format-group">
              {(['hex', 'base64'] as OutputFormat[]).map((f) => (
                <button
                  key={f}
                  className={`ade-format-btn ${outputFormat === f ? 'active' : ''}`}
                  onClick={() => setOutputFormat(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button className="ade-process-btn" onClick={process}>
            {action === 'encrypt' ? '🔒 执行加密' : '🔓 执行解密'}
          </button>
          <button className="ade-clear-btn" onClick={clear}>
            <RotateCcw size={14} />
            清空
          </button>
        </div>

        {/* Error */}
        {error && <div className="ade-error">{error}</div>}

        {/* Output */}
        {outputData && !error && (
          <div className="ade-output-area">
            <div className="ade-output-header">
              <span className="ade-output-label">
                {action === 'encrypt' ? '密文输出' : '明文输出'}
              </span>
              <button className="ade-copy-btn" onClick={copyOutput}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className="ade-output-content">{outputData}</div>

            {outputTag && (
              <>
                <div className="ade-output-header" style={{ marginTop: 12 }}>
                  <span className="ade-output-label">GCM Auth Tag (16 字节)</span>
                  <button className="ade-copy-btn" onClick={copyTag}>
                    {copiedTag ? <Check size={13} /> : <Copy size={13} />}
                    {copiedTag ? '已复制' : '复制'}
                  </button>
                </div>
                <div className="ade-output-content ade-tag">{outputTag}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
