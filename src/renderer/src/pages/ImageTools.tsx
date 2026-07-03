import { useState, useCallback, useRef } from 'react'
import { Upload, Copy, Check, Trash2, FileImage, File, Video, Music } from 'lucide-react'
import '../styles/image-tools.css'

type FileCategory = 'image' | 'video' | 'audio' | 'file'

interface FileInfo {
  name: string
  size: string
  type: string
  category: FileCategory
  dimensions?: string
  base64: string
  dataUrl: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(2) + ' MB'
}

function getFileCategory(type: string): FileCategory {
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  return 'file'
}

function getDisplayType(file: File): string {
  return file.type || 'unknown'
}

export default function ImageTools(): React.JSX.Element {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      const category = getFileCategory(file.type)
      const nextFileInfo = {
        name: file.name,
        size: formatSize(file.size),
        type: getDisplayType(file),
        category,
        base64,
        dataUrl
      }

      if (category === 'image') {
        const img = new window.Image()
        img.onload = () => {
          setFileInfo({
            ...nextFileInfo,
            dimensions: `${img.width} × ${img.height}`
          })
        }
        img.onerror = () => setFileInfo(nextFileInfo)
        img.src = dataUrl
        return
      }

      setFileInfo(nextFileInfo)
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

  const clear = useCallback(() => setFileInfo(null), [])

  const copyBase64 = useCallback(async () => {
    if (!fileInfo) return
    try {
      await navigator.clipboard.writeText(fileInfo.base64)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }, [fileInfo])

  const copyDataUrl = useCallback(async () => {
    if (!fileInfo) return
    try {
      await navigator.clipboard.writeText(fileInfo.dataUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }, [fileInfo])

  const copyImgTag = useCallback(async () => {
    if (!fileInfo || fileInfo.category !== 'image') return
    const tag = `<img src="${fileInfo.dataUrl}" alt="${fileInfo.name}" />`
    try {
      await navigator.clipboard.writeText(tag)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }, [fileInfo])

  const copyMediaTag = useCallback(async () => {
    if (!fileInfo || (fileInfo.category !== 'video' && fileInfo.category !== 'audio')) return
    const tagName = fileInfo.category
    const tag = `<${tagName} controls src="${fileInfo.dataUrl}"></${tagName}>`
    try {
      await navigator.clipboard.writeText(tag)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }, [fileInfo])

  const renderPreview = (): React.JSX.Element => {
    if (!fileInfo) return <></>

    if (fileInfo.category === 'image') {
      return <img src={fileInfo.dataUrl} alt={fileInfo.name} className="im-preview-img" />
    }

    if (fileInfo.category === 'video') {
      return <video src={fileInfo.dataUrl} className="im-preview-video" controls />
    }

    if (fileInfo.category === 'audio') {
      return (
        <div className="im-file-preview">
          <Music size={40} className="im-file-preview-icon" />
          <audio src={fileInfo.dataUrl} className="im-preview-audio" controls />
        </div>
      )
    }

    return (
      <div className="im-file-preview">
        <File size={44} className="im-file-preview-icon" />
        <span className="im-file-preview-name">{fileInfo.name}</span>
      </div>
    )
  }

  return (
    <div className="im-page">
      <div className="im-card">
        <div className="im-header">
          <h2 className="im-title">File to Base64</h2>
          <p className="im-subtitle">文件转 Base64 · Data URL 生成</p>
        </div>

        {/* Upload area */}
        {!fileInfo && (
          <div
            className={`im-dropzone ${dragOver ? 'im-dropzone-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={32} className="im-dropzone-icon" />
            <span className="im-dropzone-text">拖放文件到此处，或点击选择</span>
            <span className="im-dropzone-hint">支持图片 / 视频 / 音频 / 文档 / 压缩包等任意文件</span>
            <input
              ref={fileRef}
              type="file"
              className="im-file-input"
              onChange={handleFile}
            />
          </div>
        )}

        {/* File result */}
        {fileInfo && (
          <>
            <div className="im-preview-area">
              {renderPreview()}
              <button className="im-remove-btn" onClick={clear} title="移除">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Info */}
            <div className="im-info-grid">
              <div className="im-info-item">
                <span className="im-info-label">文件名</span>
                <span className="im-info-value">{fileInfo.name}</span>
              </div>
              {fileInfo.dimensions && (
                <div className="im-info-item">
                  <span className="im-info-label">尺寸</span>
                  <span className="im-info-value">{fileInfo.dimensions}</span>
                </div>
              )}
              <div className="im-info-item">
                <span className="im-info-label">大小</span>
                <span className="im-info-value">{fileInfo.size}</span>
              </div>
              <div className="im-info-item">
                <span className="im-info-label">类型</span>
                <span className="im-info-value">{fileInfo.type}</span>
              </div>
              <div className="im-info-item">
                <span className="im-info-label">Base64</span>
                <span className="im-info-value">{fileInfo.base64.length.toLocaleString()} 字符</span>
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
              {fileInfo.category === 'image' && (
                <button className="im-btn" onClick={copyImgTag}>
                  <FileImage size={14} />
                  复制 &lt;img&gt; 标签
                </button>
              )}
              {(fileInfo.category === 'video' || fileInfo.category === 'audio') && (
                <button className="im-btn" onClick={copyMediaTag}>
                  {fileInfo.category === 'video' ? <Video size={14} /> : <Music size={14} />}
                  复制 &lt;{fileInfo.category}&gt; 标签
                </button>
              )}
            </div>

            {/* Base64 output (truncated) */}
            <div className="im-output">
              <div className="im-output-header">Base64 输出</div>
              <code className="im-output-value">{fileInfo.base64.slice(0, 200)}{fileInfo.base64.length > 200 ? '…' : ''}</code>
              <span className="im-output-len">共 {fileInfo.base64.length.toLocaleString()} 字符</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
