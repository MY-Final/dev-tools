import { useState, useCallback, useRef } from 'react'
import { FileKey, Copy, Check, Upload, X, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
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
      result[key] = Array.isArray(result[key]) ? result[key] : result[key] ? [result[key], field.value].join(', ') : field.value as string
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
  const daysRemaining = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const isExpired = daysRemaining < 0
  const isExpiringSoon = !isExpired && daysRemaining <= 30

  // SAN (Subject Alternative Names)
  const sanExt = cert.extensions.find((e) => e.name === 'subjectAltName') as
    | { altNames?: { type: number; value: string; ip?: string }[] }
    | undefined
  const sans: { type: string; value: string }[] = []
  if (sanExt?.altNames) {
    for (const alt of sanExt.altNames) {
      const typeMap: Record<number, string> = { 2: 'DNS', 7: 'IP', 1: 'Email', 6: 'URI', 0: 'Other' }
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
    publicKeySize = 256 // default
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
        value = typeof ext.value === 'string' ? ext.value : forge.util.bytesToHex(ext.value as string)
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

  return (
    <div className="cp-page">
      <div className="cp-card">
        <div className="cp-header">
          <h2 className="cp-title">Certificate Parser</h2>
          <p className="cp-subtitle">解析 PEM/X.509 证书信息</p>
        </div>

        {/* PEM Input */}
        <div className="cp-input-area">
          <div className="cp-input-header">
            <span className="cp-input-label">PEM 证书</span>
            <div className="cp-input-actions">
              <button className="cp-upload-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={12} />
                上传文件
              </button>
              {certInfo && (
                <button className="cp-clear-btn" onClick={clear}>
                  <X size={12} />
                  清空
                </button>
              )}
            </div>
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
              rows={6}
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pem,.crt,.cer,.der,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
            style={{ display: 'none' }}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="cp-error">
            <XCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Certificate Info */}
        {certInfo && (
          <div className="cp-result">
            {/* Status banner */}
            <div
              className={`cp-status ${certInfo.isExpired ? 'expired' : certInfo.isExpiringSoon ? 'warning' : 'valid'}`}
            >
              {certInfo.isExpired ? (
                <XCircle size={16} />
              ) : certInfo.isExpiringSoon ? (
                <AlertTriangle size={16} />
              ) : (
                <CheckCircle size={16} />
              )}
              <span>
                {certInfo.isExpired
                  ? `证书已过期 ${Math.abs(certInfo.daysRemaining)} 天`
                  : certInfo.isExpiringSoon
                    ? `证书将在 ${certInfo.daysRemaining} 天后过期`
                    : `证书有效，剩余 ${certInfo.daysRemaining} 天`}
              </span>
            </div>

            {/* Subject */}
            <div className="cp-section">
              <h3 className="cp-section-title">
                <FileKey size={14} />
                Subject
              </h3>
              <div className="cp-field-list">
                {Object.entries(certInfo.subject).map(([key, value]) => (
                  <div key={key} className="cp-field">
                    <span className="cp-field-key">{DN_LABELS[key] || key}</span>
                    <span className="cp-field-value">{value}</span>
                    <button
                      className="cp-field-copy"
                      onClick={() => copyField(`subject-${key}`, value)}
                    >
                      {copiedField === `subject-${key}` ? (
                        <Check size={11} />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Issuer */}
            <div className="cp-section">
              <h3 className="cp-section-title">
                <FileKey size={14} />
                Issuer
              </h3>
              <div className="cp-field-list">
                {Object.entries(certInfo.issuer).map(([key, value]) => (
                  <div key={key} className="cp-field">
                    <span className="cp-field-key">{DN_LABELS[key] || key}</span>
                    <span className="cp-field-value">{value}</span>
                    <button
                      className="cp-field-copy"
                      onClick={() => copyField(`issuer-${key}`, value)}
                    >
                      {copiedField === `issuer-${key}` ? (
                        <Check size={11} />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Validity */}
            <div className="cp-section">
              <h3 className="cp-section-title">
                <FileKey size={14} />
                Validity
              </h3>
              <div className="cp-field-list">
                <div className="cp-field">
                  <span className="cp-field-key">Not Before</span>
                  <span className="cp-field-value">{certInfo.validFrom}</span>
                </div>
                <div className="cp-field">
                  <span className="cp-field-key">Not After</span>
                  <span className="cp-field-value">{certInfo.validTo}</span>
                </div>
                <div className="cp-field">
                  <span className="cp-field-key">Serial Number</span>
                  <span className="cp-field-value cp-mono">{certInfo.serialNumber}</span>
                  <button
                    className="cp-field-copy"
                    onClick={() => copyField('serial', certInfo.serialNumber)}
                  >
                    {copiedField === 'serial' ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
                <div className="cp-field">
                  <span className="cp-field-key">Version</span>
                  <span className="cp-field-value">{certInfo.version}</span>
                </div>
                <div className="cp-field">
                  <span className="cp-field-key">Signature Algorithm</span>
                  <span className="cp-field-value">{certInfo.signatureAlgorithm}</span>
                </div>
              </div>
            </div>

            {/* Public Key */}
            <div className="cp-section">
              <h3 className="cp-section-title">
                <FileKey size={14} />
                Public Key
              </h3>
              <div className="cp-field-list">
                <div className="cp-field">
                  <span className="cp-field-key">Algorithm</span>
                  <span className="cp-field-value">{certInfo.publicKeyAlgorithm}</span>
                </div>
                <div className="cp-field">
                  <span className="cp-field-key">Key Size</span>
                  <span className="cp-field-value">{certInfo.publicKeySize} bits</span>
                </div>
              </div>
            </div>

            {/* SAN */}
            {certInfo.sans.length > 0 && (
              <div className="cp-section">
                <h3 className="cp-section-title">
                  <FileKey size={14} />
                  Subject Alternative Names ({certInfo.sans.length})
                </h3>
                <div className="cp-san-list">
                  {certInfo.sans.map((san, i) => (
                    <div key={i} className="cp-san-item">
                      <span className="cp-san-type">{san.type}</span>
                      <span className="cp-san-value">{san.value}</span>
                      <button
                        className="cp-field-copy"
                        onClick={() => copyField(`san-${i}`, san.value)}
                      >
                        {copiedField === `san-${i}` ? <Check size={11} /> : <Copy size={11} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extensions */}
            {certInfo.extensions.length > 0 && (
              <div className="cp-section">
                <h3 className="cp-section-title">
                  <FileKey size={14} />
                  Extensions
                </h3>
                <div className="cp-field-list">
                  {certInfo.extensions.map((ext, i) => (
                    <div key={i} className="cp-field">
                      <span className="cp-field-key">{ext.name}</span>
                      <span className="cp-field-value cp-mono">{ext.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fingerprint */}
            <div className="cp-section">
              <h3 className="cp-section-title">
                <FileKey size={14} />
                Fingerprint
              </h3>
              <div className="cp-field-list">
                <div className="cp-field">
                  <span className="cp-field-key">SHA-1</span>
                  <span className="cp-field-value cp-mono">{certInfo.fingerprints.sha1}</span>
                  <button
                    className="cp-field-copy"
                    onClick={() => copyField('sha1', certInfo.fingerprints.sha1)}
                  >
                    {copiedField === 'sha1' ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
                <div className="cp-field">
                  <span className="cp-field-key">SHA-256</span>
                  <span className="cp-field-value cp-mono">{certInfo.fingerprints.sha256}</span>
                  <button
                    className="cp-field-copy"
                    onClick={() => copyField('sha256', certInfo.fingerprints.sha256)}
                  >
                    {copiedField === 'sha256' ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
