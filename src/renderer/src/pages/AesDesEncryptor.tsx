import { useState, useCallback } from 'react'
import { Lock, Unlock, Copy, Check, RotateCcw, RefreshCw } from 'lucide-react'
import forge from 'node-forge'
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  bytesToBase64,
  bytesToHex,
  concatBytes,
  hexToBytes,
  toArrayBuffer
} from '../lib/crypto-utils'
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
    case 'hex':
      return hexToBytes(input)
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
  mode: AesMode
): Promise<{ ciphertext: Uint8Array; tag?: Uint8Array }> {
  if (mode === 'ECB') {
    const cipher = forge.cipher.createCipher('AES-ECB', uint8ToForgeBuffer(keyBytes))
    cipher.start()
    cipher.update(uint8ToForgeBuffer(data))
    cipher.finish()
    const out = cipher.output.bytes()
    return { ciphertext: Uint8Array.from(out, (c) => c.charCodeAt(0)) }
  }

  if (mode === 'GCM') {
    return aesGcmEncrypt(data, keyBytes, ivBytes!)
  }

  const algoName = mode === 'CTR' ? 'AES-CTR' : 'AES-CBC'
  const algoParams: AesCtrParams | AesCbcParams =
    mode === 'CTR'
      ? { name: 'AES-CTR', counter: toArrayBuffer(ivBytes!), length: 64 }
      : { name: 'AES-CBC', iv: toArrayBuffer(ivBytes!) }

  const cryptoKey = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), algoName, false, [
    'encrypt'
  ])
  const result = await crypto.subtle.encrypt(algoParams, cryptoKey, toArrayBuffer(data))
  return { ciphertext: new Uint8Array(result) }
}

async function aesDecrypt(
  data: Uint8Array,
  keyBytes: Uint8Array,
  ivBytes: Uint8Array | null,
  mode: AesMode,
  tag?: Uint8Array
): Promise<Uint8Array> {
  if (mode === 'ECB') {
    const decipher = forge.cipher.createDecipher('AES-ECB', uint8ToForgeBuffer(keyBytes))
    decipher.start()
    decipher.update(uint8ToForgeBuffer(data))
    decipher.finish()
    const out = decipher.output.bytes()
    return Uint8Array.from(out, (c) => c.charCodeAt(0))
  }

  if (mode === 'GCM') {
    return aesGcmDecrypt(tag ? concatBytes(data, tag) : data, keyBytes, ivBytes!)
  }

  const algoName = mode === 'CTR' ? 'AES-CTR' : 'AES-CBC'
  const algoParams: AesCtrParams | AesCbcParams =
    mode === 'CTR'
      ? { name: 'AES-CTR', counter: toArrayBuffer(ivBytes!), length: 64 }
      : { name: 'AES-CBC', iv: toArrayBuffer(ivBytes!) }

  const cryptoKey = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), algoName, false, [
    'decrypt'
  ])
  const result = await crypto.subtle.decrypt(algoParams, cryptoKey, toArrayBuffer(data))
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
  const keySizeBytes =
    cipherType === 'AES' ? AES_KEY_SIZES[aesKeySize].bytes : cipherType === 'DES' ? 8 : 24

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
  const process = useCallback(
    async (act: Action) => {
      setAction(act)
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
          setError(
            `密钥长度必须为 ${keySizeBytes} 字节 (${keySizeBytes * 8} bits)，当前为 ${keyBytes.length} 字节`
          )
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
          if (act === 'encrypt') {
            const dataBytes = parseBytes(inputData, inputFormat)
            const result = await aesEncrypt(dataBytes, keyBytes, ivBytes, aesMode)
            const outputBytes = result.tag
              ? concatBytes(result.ciphertext, result.tag)
              : result.ciphertext
            setOutputData(formatOutput(outputBytes, outputFormat))
            if (result.tag) setOutputTag(bytesToHex(result.tag))
          } else {
            const dataBytes = parseBytes(inputData, inputFormat)
            const result = await aesDecrypt(dataBytes, keyBytes, ivBytes, aesMode)
            setOutputData(new TextDecoder().decode(result))
          }
        } else {
          const isTriple = cipherType === '3DES'
          if (act === 'encrypt') {
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
    },
    [
      inputData,
      inputFormat,
      keyInput,
      keyFormat,
      ivInput,
      ivFormat,
      cipherType,
      aesMode,
      outputFormat,
      needsIv,
      mode,
      keySizeBytes
    ]
  )

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
    <div className="ade-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">AES / DES Encryptor</h2>
          <p className="tool-page-desc">
            使用 Web Crypto 与 node-forge 进行对称加密和解密，支持 AES、DES 与 3DES。
          </p>
        </div>
        <div className="tool-page-actions">
          <button type="button" className="tool-btn tool-btn--outline" onClick={clear}>
            <RotateCcw size={14} aria-hidden="true" />
            清空
          </button>
        </div>
      </header>

      <section className="tool-panel ade-toolbar">
        <div className="ade-toolbar-row">
          <div className="ade-toolbar-group">
            <span className="ade-label">算法</span>
            <div className="tool-segmented" role="group" aria-label="加密算法">
              {(['AES', 'DES', '3DES'] as CipherType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`tool-seg ${cipherType === t ? 'active' : ''}`}
                  onClick={() => setCipherType(t)}
                  aria-pressed={cipherType === t}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="ade-toolbar-group">
            <span className="ade-label">模式</span>
            <div className="tool-segmented" role="group" aria-label="加密模式">
              {(cipherType === 'AES' ? AES_MODES : DES_MODES).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`tool-seg ${mode === m ? 'active' : ''}`}
                  onClick={() =>
                    cipherType === 'AES' ? setAesMode(m as AesMode) : setDesMode(m as DesMode)
                  }
                  aria-pressed={mode === m}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {cipherType === 'AES' && (
            <div className="ade-toolbar-group">
              <span className="ade-label">密钥长度</span>
              <div className="tool-segmented" role="group" aria-label="AES 密钥长度">
                {AES_KEY_SIZES.map((s, i) => (
                  <button
                    key={s.bits}
                    type="button"
                    className={`tool-seg ${aesKeySize === i ? 'active' : ''}`}
                    onClick={() => setAesKeySize(i)}
                    aria-pressed={aesKeySize === i}
                  >
                    {s.bits}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="tool-split tool-split--even ade-layout">
        <section className="tool-panel ade-input-panel">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">输入</h3>
            <span className="ade-hint">
              密钥 {keySizeBytes} 字节 / {keySizeBytes * 8} bit
            </span>
          </div>

          <div className="ade-field">
            <div className="ade-field-head">
              <label className="ade-label" htmlFor="ade-key">
                密钥 Key
              </label>
              <div className="ade-field-tools">
                <div className="tool-segmented" role="group" aria-label="密钥格式">
                  {(['text', 'hex', 'base64'] as InputFormat[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`tool-seg ${keyFormat === f ? 'active' : ''}`}
                      onClick={() => setKeyFormat(f)}
                      aria-pressed={keyFormat === f}
                    >
                      {f === 'text' ? '文本' : f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="tool-icon-btn"
                  onClick={generateKey}
                  title="生成随机密钥"
                  aria-label="生成随机密钥"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            <input
              id="ade-key"
              className="tool-input tool-input--mono"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={`输入 ${keySizeBytes} 字节密钥…`}
              spellCheck={false}
            />
          </div>

          {needsIv && (
            <div className="ade-field">
              <div className="ade-field-head">
                <label className="ade-label" htmlFor="ade-iv">
                  IV / Nonce
                  <span className="ade-hint"> {mode === 'GCM' ? 12 : 16} 字节</span>
                </label>
                <div className="ade-field-tools">
                  <div className="tool-segmented" role="group" aria-label="IV 格式">
                    {(['hex', 'base64'] as InputFormat[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`tool-seg ${ivFormat === f ? 'active' : ''}`}
                        onClick={() => setIvFormat(f)}
                        aria-pressed={ivFormat === f}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="tool-icon-btn"
                    onClick={generateIv}
                    title="生成随机 IV"
                    aria-label="生成随机 IV"
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <input
                id="ade-iv"
                className="tool-input tool-input--mono"
                value={ivInput}
                onChange={(e) => setIvInput(e.target.value)}
                placeholder={`输入 ${mode === 'GCM' ? 12 : 16} 字节 IV…`}
                spellCheck={false}
              />
            </div>
          )}

          <div className="ade-field ade-field--data">
            <div className="ade-field-head">
              <label className="ade-label" htmlFor="ade-data">
                {action === 'encrypt' ? '明文' : '密文'}
              </label>
              <div className="tool-segmented" role="group" aria-label="输入格式">
                {(['text', 'hex', 'base64'] as InputFormat[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`tool-seg ${inputFormat === f ? 'active' : ''}`}
                    onClick={() => setInputFormat(f)}
                    aria-pressed={inputFormat === f}
                  >
                    {f === 'text' ? '文本' : f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="ade-data"
              className="ade-textarea"
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              placeholder={action === 'encrypt' ? '输入要加密的文本…' : '输入要解密的密文…'}
              rows={7}
              spellCheck={false}
            />
          </div>

          <div className="ade-actions">
            <button
              type="button"
              className="tool-btn tool-btn--primary"
              onClick={() => void process('encrypt')}
            >
              <Lock size={14} aria-hidden="true" />
              加密
            </button>
            <button
              type="button"
              className="tool-btn tool-btn--outline"
              onClick={() => void process('decrypt')}
            >
              <Unlock size={14} aria-hidden="true" />
              解密
            </button>
          </div>
        </section>

        <section className="tool-panel ade-output-panel">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">输出</h3>
            <div className="ade-output-actions">
              <div className="tool-segmented" role="group" aria-label="输出格式">
                {(['hex', 'base64'] as OutputFormat[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`tool-seg ${outputFormat === f ? 'active' : ''}`}
                    onClick={() => setOutputFormat(f)}
                    aria-pressed={outputFormat === f}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="tool-btn"
                onClick={copyOutput}
                disabled={!outputData}
              >
                {copied ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>

          {error ? (
            <div className="ade-error" role="status">
              {error}
            </div>
          ) : outputData ? (
            <div className="ade-output-body">
              <div className="ade-output-label">
                {action === 'encrypt'
                  ? mode === 'GCM'
                    ? '密文（已附带 Auth Tag）'
                    : '密文'
                  : '明文'}
              </div>
              <pre className="ade-output-content">{outputData}</pre>

              {outputTag && (
                <div className="ade-tag-block">
                  <div className="ade-output-label">
                    GCM Auth Tag · 16 字节
                    <button type="button" className="tool-btn" onClick={copyTag}>
                      {copiedTag ? (
                        <Check size={13} aria-hidden="true" />
                      ) : (
                        <Copy size={13} aria-hidden="true" />
                      )}
                      {copiedTag ? '已复制' : '复制 Tag'}
                    </button>
                  </div>
                  <pre className="ade-output-content">{outputTag}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="ade-empty">填写密钥与 IV，输入内容后点击「加密」或「解密」。</div>
          )}
        </section>
      </div>
    </div>
  )
}
