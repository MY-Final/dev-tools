import { useState, useCallback, useRef } from 'react'
import { Copy, Check, Upload, X, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import forge from 'node-forge'
import '../styles/certificate-parser.css'

interface CertInfo {
  subject: Record<string, string>
  issuer: Record<string, string>
  serialNumber: string
  validFrom: string
  validTo: string
  daysRemaining: number
  isExpired: boolean
  isExpiringSoon: boolean
  sans: { type: string; value: string }[]
  publicKeyAlgorithm: string
  publicKeySize: number
  signatureAlgorithm: string
  version: string
  fingerprints: { sha1: string; sha256: string }
  extensions: { name: string; value: string }[]
  rawPem: string
}

// ── Helpers ────────────────────────────────────────────────────

function formatDN(dn: forge.pki.CertificateField[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const field of dn) {
    if (field.shortName && field.value) {
      const key = field.shortName
      result[key] = Array.isArray(result[key])
        ? result[key]
        : result[key]
          ? [result[key], field.value].join(', ')
          : (field.value as string)
    } else if (field.name && field.value) {
      result[field.name] = field.value as string
    }
  }
  return result
}

const DN_LABELS: Record<string, string> = {
  CN: 'Common Name',
  O: 'Organization',
  OU: 'Organizational Unit',
  L: 'Locality',
  ST: 'State',
  C: 'Country',
  emailAddress: 'Email'
}

interface EcPublicKeyShape {
  ec?: {
    curve?: {
      fieldSize?: number
      keySize?: number
      n?: { bitLength?: () => number }
      q?: { bitLength?: () => number }
    }
  }
}

function getEcKeySize(publicKey: unknown): number {
  if (typeof publicKey !== 'object' || publicKey === null || !('ec' in publicKey)) return 0

  const curve = (publicKey as EcPublicKeyShape).ec?.curve
  if (!curve) return 0
  if (typeof curve.fieldSize === 'number') return curve.fieldSize
  if (typeof curve.keySize === 'number') return curve.keySize
  if (typeof curve.n?.bitLength === 'function') return curve.n.bitLength()
  if (typeof curve.q?.bitLength === 'function') return curve.q.bitLength()
  return 0
}

function parseCertificate(pem: string): CertInfo {
  const cert = forge.pki.certificateFromPem(pem)

  // Subject & Issuer
  const subject = formatDN(cert.subject.attributes)
  const issuer = formatDN(cert.issuer.attributes)

  // Serial Number
  const serialNumber = cert.serialNumber

  // Validity
  const now = new Date()
  const validFrom = cert.validity.notBefore
  const validTo = cert.validity.notAfter
  const remainingTime = validTo.getTime() - now.getTime()
  const daysRemaining = Math.ceil(remainingTime / (1000 * 60 * 60 * 24))
  const isExpired = remainingTime < 0
  const isExpiringSoon = !isExpired && daysRemaining <= 30

  // SAN (Subject Alternative Names)
  const sanExt = cert.extensions.find((e) => e.name === 'subjectAltName') as
    | { altNames?: { type: number; value: string; ip?: string }[] }
    | undefined
  const sans: { type: string; value: string }[] = []
  if (sanExt?.altNames) {
    for (const alt of sanExt.altNames) {
      const typeMap: Record<number, string> = {
        2: 'DNS',
        7: 'IP',
        1: 'Email',
        6: 'URI',
        0: 'Other'
      }
      sans.push({
        type: typeMap[alt.type] || `Type ${alt.type}`,
        value: alt.value || alt.ip || ''
      })
    }
  }

  // Public Key
  const pubKey = cert.publicKey
  let publicKeyAlgorithm = 'Unknown'
  let publicKeySize = 0
  if (pubKey && 'n' in pubKey && (pubKey as forge.pki.rsa.PublicKey).n) {
    publicKeyAlgorithm = 'RSA'
    publicKeySize = ((pubKey as forge.pki.rsa.PublicKey).n as forge.jsbn.BigInteger).bitLength()
  } else if ('ec' in (pubKey as object)) {
    publicKeyAlgorithm = 'EC'
    publicKeySize = getEcKeySize(pubKey)
  }

  // Signature Algorithm
  const sigOid = cert.siginfo.algorithmOid
  const sigAlgMap: Record<string, string> = {
    '1.2.840.113549.1.1.5': 'SHA-1 with RSA',
    '1.2.840.113549.1.1.11': 'SHA-256 with RSA',
    '1.2.840.113549.1.1.12': 'SHA-384 with RSA',
    '1.2.840.113549.1.1.13': 'SHA-512 with RSA',
    '1.2.840.10045.4.3.2': 'ECDSA with SHA-256',
    '1.2.840.10045.4.3.3': 'ECDSA with SHA-384',
    '1.2.840.10045.4.3.4': 'ECDSA with SHA-512'
  }
  const signatureAlgorithm = sigAlgMap[sigOid] || `OID: ${sigOid}`

  // Version
  const version = `v${cert.version + 1}`

  // Fingerprint
  const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  const sha1 = forge.md.sha1.create().update(derBytes).digest().toHex()
  const sha256 = forge.md.sha256.create().update(derBytes).digest().toHex()

  // Extensions
  const extensions: { name: string; value: string }[] = []
  for (const ext of cert.extensions) {
    if (ext.name === 'subjectAltName') continue // already shown separately
    let value = ''
    if (ext.name === 'basicConstraints') {
      value = (ext as { cA?: boolean }).cA ? 'CA: TRUE' : 'CA: FALSE'
    } else if (ext.name === 'keyUsage') {
      const usages: string[] = []
      const ku = ext as Record<string, boolean | undefined>
      if (ku.digitalSignature) usages.push('Digital Signature')
      if (ku.keyEncipherment) usages.push('Key Encipherment')
      if (ku.keyCertSign) usages.push('Certificate Sign')
      if (ku.cRLSign) usages.push('CRL Sign')
      value = usages.join(', ')
    } else if (ext.name === 'extKeyUsage') {
      const usages: string[] = []
      const eku = ext as Record<string, boolean | undefined>
      if (eku.serverAuth) usages.push('Server Authentication')
      if (eku.clientAuth) usages.push('Client Authentication')
      if (eku.emailProtection) usages.push('Email Protection')
      value = usages.join(', ')
    } else if (ext.value) {
      try {
        value =
          typeof ext.value === 'string' ? ext.value : forge.util.bytesToHex(ext.value as string)
      } catch {
        value = '(binary data)'
      }
    }
    if (value) extensions.push({ name: ext.name, value })
  }

  return {
    subject,
    issuer,
    serialNumber,
    validFrom: validFrom.toISOString().split('T')[0],
    validTo: validTo.toISOString().split('T')[0],
    daysRemaining,
    isExpired,
    isExpiringSoon,
    sans,
    publicKeyAlgorithm,
    publicKeySize,
    signatureAlgorithm,
    version,
    fingerprints: {
      sha1: sha1.match(/.{2}/g)?.join(':').toUpperCase() || sha1,
      sha256: sha256.match(/.{2}/g)?.join(':').toUpperCase() || sha256
    },
    extensions,
    rawPem: pem
  }
}

// ── Component ──────────────────────────────────────────────────

export default function CertificateParser(): React.JSX.Element {
  const [pemInput, setPemInput] = useState('')
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null)
  const [error, setError] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePem = useCallback((pem: string) => {
    setPemInput(pem)
    setError('')
    setCertInfo(null)

    if (!pem.trim()) return

    try {
      const info = parseCertificate(pem)
      setCertInfo(info)
    } catch (err) {
      setError(err instanceof Error ? err.message : '证书解析失败，请检查 PEM 格式')
    }
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        handlePem(text)
      }
      reader.readAsText(file)
    },
    [handlePem]
  )

  const copyField = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(key)
      setTimeout(() => setCopiedField(null), 1500)
    } catch {
      /* ignore */
    }
  }, [])

  const clear = useCallback(() => {
    setPemInput('')
    setCertInfo(null)
    setError('')
  }, [])

  const renderRows = (
    rows: { key: string; label: string; value: string; copyKey?: string; mono?: boolean }[]
  ): React.JSX.Element => (
    <div className="cp-rows">
      {rows.map((row) => (
        <div key={row.key} className="cp-row">
          <span className="cp-row-key">{row.label}</span>
          <span className={`cp-row-value ${row.mono ? 'cp-mono' : ''}`}>{row.value}</span>
          {row.copyKey && (
            <button
              type="button"
              className="tool-icon-btn cp-row-copy"
              onClick={() => copyField(row.copyKey!, row.value)}
              title="复制"
              aria-label={`复制 ${row.label}`}
            >
              {copiedField === row.copyKey ? (
                <Check size={12} aria-hidden="true" />
              ) : (
                <Copy size={12} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  )

  const subjectRows = certInfo
    ? Object.entries(certInfo.subject).map(([key, value]) => ({
        key,
        label: DN_LABELS[key] || key,
        value,
        copyKey: `subject-${key}`
      }))
    : []

  const issuerRows = certInfo
    ? Object.entries(certInfo.issuer).map(([key, value]) => ({
        key,
        label: DN_LABELS[key] || key,
        value,
        copyKey: `issuer-${key}`
      }))
    : []

  const statusText = certInfo
    ? certInfo.isExpired
      ? Math.abs(certInfo.daysRemaining) > 0
        ? `已过期 ${Math.abs(certInfo.daysRemaining)} 天`
        : '已过期（不足 1 天）'
      : certInfo.isExpiringSoon
        ? `${certInfo.daysRemaining} 天后过期`
        : `有效，剩余 ${certInfo.daysRemaining} 天`
    : ''

  return (
    <div className="cp-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Certificate Parser</h2>
          <p className="tool-page-desc">
            解析 PEM / X.509 证书，查看主体、签发者、有效期、公钥、SAN 与指纹。
          </p>
        </div>
        <div className="tool-page-actions">
          <button
            type="button"
            className="tool-btn tool-btn--outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} aria-hidden="true" />
            上传文件
          </button>
          <button
            type="button"
            className="tool-btn tool-btn--outline"
            onClick={clear}
            disabled={!pemInput && !certInfo}
          >
            <X size={14} aria-hidden="true" />
            清空
          </button>
        </div>
      </header>

      <div className="tool-split cp-layout">
        <section className="tool-panel cp-input">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">PEM 证书</h3>
            <span className="cp-input-hint">支持 .pem / .crt / .cer / .txt</span>
          </div>
          <div
            className={`cp-dropzone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files[0]
              if (f) handleFile(f)
            }}
          >
            <textarea
              className="cp-textarea"
              value={pemInput}
              onChange={(e) => handlePem(e.target.value)}
              placeholder={`-----BEGIN CERTIFICATE-----\nMIIDxTCCAq2gAwIBAgIQAqxcJm...\n-----END CERTIFICATE-----`}
              rows={14}
              spellCheck={false}
              aria-label="PEM 证书内容"
            />
            <p className="cp-dropzone-hint">也可以将证书文件拖放到此处</p>
          </div>

          {error && (
            <p className="cp-error" role="status">
              <XCircle size={14} aria-hidden="true" />
              {error}
            </p>
          )}
        </section>

        <section className="tool-panel cp-results">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">证书信息</h3>
            {certInfo && (
              <span
                className={`cp-status ${certInfo.isExpired ? 'expired' : certInfo.isExpiringSoon ? 'warning' : 'valid'}`}
                role="status"
              >
                {certInfo.isExpired ? (
                  <XCircle size={12} aria-hidden="true" />
                ) : certInfo.isExpiringSoon ? (
                  <AlertTriangle size={12} aria-hidden="true" />
                ) : (
                  <CheckCircle size={12} aria-hidden="true" />
                )}
                {statusText}
              </span>
            )}
          </div>

          {certInfo ? (
            <div className="cp-body">
              <section className="cp-block">
                <h4 className="cp-block-title">Subject</h4>
                {renderRows(subjectRows)}
              </section>

              <section className="cp-block">
                <h4 className="cp-block-title">Issuer</h4>
                {renderRows(issuerRows)}
              </section>

              <section className="cp-block">
                <h4 className="cp-block-title">Validity</h4>
                {renderRows([
                  { key: 'from', label: 'Not Before', value: certInfo.validFrom },
                  { key: 'to', label: 'Not After', value: certInfo.validTo },
                  {
                    key: 'serial',
                    label: 'Serial Number',
                    value: certInfo.serialNumber,
                    copyKey: 'serial',
                    mono: true
                  },
                  { key: 'version', label: 'Version', value: certInfo.version },
                  {
                    key: 'sig',
                    label: 'Signature Algorithm',
                    value: certInfo.signatureAlgorithm
                  }
                ])}
              </section>

              <section className="cp-block">
                <h4 className="cp-block-title">Public Key</h4>
                {renderRows([
                  { key: 'pk-alg', label: 'Algorithm', value: certInfo.publicKeyAlgorithm },
                  {
                    key: 'pk-size',
                    label: 'Key Size',
                    value: certInfo.publicKeySize > 0 ? `${certInfo.publicKeySize} bits` : 'Unknown'
                  }
                ])}
              </section>

              {certInfo.sans.length > 0 && (
                <section className="cp-block">
                  <h4 className="cp-block-title">
                    Subject Alternative Names
                    <span className="cp-block-count">{certInfo.sans.length}</span>
                  </h4>
                  <div className="cp-rows">
                    {certInfo.sans.map((san, i) => (
                      <div key={i} className="cp-row">
                        <span className="cp-san-type">{san.type}</span>
                        <span className="cp-row-value cp-mono">{san.value}</span>
                        <button
                          type="button"
                          className="tool-icon-btn cp-row-copy"
                          onClick={() => copyField(`san-${i}`, san.value)}
                          title="复制"
                          aria-label={`复制 SAN ${san.value}`}
                        >
                          {copiedField === `san-${i}` ? (
                            <Check size={12} aria-hidden="true" />
                          ) : (
                            <Copy size={12} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {certInfo.extensions.length > 0 && (
                <section className="cp-block">
                  <h4 className="cp-block-title">
                    Extensions
                    <span className="cp-block-count">{certInfo.extensions.length}</span>
                  </h4>
                  {renderRows(
                    certInfo.extensions.map((ext, i) => ({
                      key: `ext-${i}`,
                      label: ext.name,
                      value: ext.value,
                      mono: true
                    }))
                  )}
                </section>
              )}

              <section className="cp-block">
                <h4 className="cp-block-title">Fingerprint</h4>
                {renderRows([
                  {
                    key: 'sha1',
                    label: 'SHA-1',
                    value: certInfo.fingerprints.sha1,
                    copyKey: 'sha1',
                    mono: true
                  },
                  {
                    key: 'sha256',
                    label: 'SHA-256',
                    value: certInfo.fingerprints.sha256,
                    copyKey: 'sha256',
                    mono: true
                  }
                ])}
              </section>
            </div>
          ) : (
            <div className="cp-empty">粘贴 PEM 内容或拖入证书文件后，将自动显示解析结果。</div>
          )}
        </section>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pem,.crt,.cer,.der,.txt"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
        hidden
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  )
}
