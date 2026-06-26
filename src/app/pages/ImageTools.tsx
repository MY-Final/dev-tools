import { useState, useCallback, useRef } from 'react'
import { Upload, Copy, Check, Trash2, FileImage } from 'lucide-react'
import '../styles/image-tools.css'

interface ImageInfo {
  name: string
  size: string
  dimensions: string
  type: string
  base64: string
  dataUrl: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(2) + ' MB'
}

export default function ImageTools(): React.JSX.Element {
  const [image, setImage] = useState<ImageInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]

      const img = new window.Image()
      img.onload = () => {
        setImage({
          name: file.name,
          size: formatSize(file.size),
          dimensions: `${img.width} × ${img.height}`,
          type: file.type,
          base64,
          dataUrl
        })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const clear = useCallback(() => setImage(null), [])

  const copyBase64 = useCallback(async () => {
    if (!image) return
    try {
      await navigator.clipboard.writeText(image.base64)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }, [image])

  const copyDataUrl = useCallback(async () => {
    if (!image) return
    try {
      await navigator.clipboard.writeText(image.dataUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }, [image])

  const copyImgTag = useCallback(async () => {
    if (!image) return
    const tag = `<img src="${image.dataUrl}" alt="${image.name}" />`
    try {
      await navigator.clipboard.writeText(tag)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }, [image])

  return (
    <div className="im-page">
      <div className="im-card">
        <div className="im-header">
          <h2 className="im-title">Image Tools</h2>
          <p className="im-subtitle">图片转 Base64 · 图片信息查看</p>
        </div>

        {/* Upload area */}
        {!image && (
          <div
            className={`im-dropzone ${dragOver ? 'im-dropzone-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={32} className="im-dropzone-icon" />
            <span className="im-dropzone-text">拖放图片到此处，或点击选择</span>
            <span className="im-dropzone-hint">支持 PNG / JPG / GIF / SVG / WebP</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="im-file-input"
              onChange={handleFile}
            />
          </div>
        )}

        {/* Image result */}
        {image && (
          <>
            <div className="im-preview-area">
              <img src={image.dataUrl} alt={image.name} className="im-preview-img" />
              <button className="im-remove-btn" onClick={clear} title="移除">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Info */}
            <div className="im-info-grid">
              <div className="im-info-item">
                <span className="im-info-label">文件名</span>
                <span className="im-info-value">{image.name}</span>
              </div>
              <div className="im-info-item">
                <span className="im-info-label">尺寸</span>
                <span className="im-info-value">{image.dimensions}</span>
              </div>
              <div className="im-info-item">
                <span className="im-info-label">大小</span>
                <span className="im-info-value">{image.size}</span>
              </div>
              <div className="im-info-item">
                <span className="im-info-label">格式</span>
                <span className="im-info-value">{image.type}</span>
              </div>
            </div>

            {/* Copy buttons */}
            <div className="im-copy-actions">
              <button className="im-btn im-btn-primary" onClick={copyBase64}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                复制 Base64
              </button>
              <button className="im-btn" onClick={copyDataUrl}>
                <Copy size={14} />
                复制 Data URL
              </button>
              <button className="im-btn" onClick={copyImgTag}>
                <FileImage size={14} />
                复制 &lt;img&gt; 标签
              </button>
            </div>

            {/* Base64 output (truncated) */}
            <div className="im-output">
              <div className="im-output-header">Base64 输出</div>
              <code className="im-output-value">{image.base64.slice(0, 200)}{image.base64.length > 200 ? '…' : ''}</code>
              <span className="im-output-len">共 {image.base64.length.toLocaleString()} 字符</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
