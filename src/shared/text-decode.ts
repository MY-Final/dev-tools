import type { FileEncoding } from './contracts'

/**
 * Text tools only ever need plain text, and a hard ceiling keeps a stray
 * multi-gigabyte selection from freezing the renderer or main process.
 */
export const MAX_TEXT_BYTES = 32 * 1024 * 1024

/**
 * Decodes as UTF-8 unless the bytes are clearly not valid UTF-8, in which case
 * GBK is tried — that is what most Chinese CSV exports use. Explicit requests
 * win over detection.
 *
 * Shared by the Electron main process and the web build so both shells decode
 * files the same way.
 */
export function decodeText(
  buffer: Uint8Array,
  requested: FileEncoding
): { content: string; encoding: 'utf-8' | 'gbk' } {
  if (requested === 'gbk') {
    return { content: new TextDecoder('gbk').decode(buffer), encoding: 'gbk' }
  }

  // Decoding a partial trailing multibyte sequence is preferable to failing.
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  if (requested === 'utf-8' || !utf8.includes('�')) {
    return { content: utf8, encoding: 'utf-8' }
  }

  try {
    const gbk = new TextDecoder('gbk').decode(buffer)
    // Only accept the fallback when it actually removes the replacement chars.
    if ((gbk.match(/�/g) ?? []).length < (utf8.match(/�/g) ?? []).length) {
      return { content: gbk, encoding: 'gbk' }
    }
  } catch {
    // Encoding unsupported in this build; keep the UTF-8 reading.
  }

  return { content: utf8, encoding: 'utf-8' }
}
