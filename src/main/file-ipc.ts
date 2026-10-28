import { dialog, shell } from 'electron'
import { promises as fs } from 'fs'
import { basename, extname } from 'path'
import { registerGuardedHandler } from './ipc-security'
import type { FileEncoding, OpenedFile, SaveFileResult } from '../shared/contracts'
import { decodeText, MAX_TEXT_BYTES } from '../shared/text-decode'

const MAX_RECENT_FILES = 10

const TEXT_EXTENSIONS = [
  'txt',
  'md',
  'markdown',
  'json',
  'jsonc',
  'json5',
  'yaml',
  'yml',
  'toml',
  'xml',
  'csv',
  'tsv',
  'log',
  'ini',
  'conf',
  'env',
  'html',
  'htm',
  'css',
  'scss',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'sql',
  'sh',
  'ps1',
  'py',
  'java',
  'go',
  'rs',
  'c',
  'h',
  'cpp',
  'diff',
  'patch'
]

const recentFiles: string[] = []

function rememberFile(filePath: string): void {
  const index = recentFiles.indexOf(filePath)
  if (index !== -1) recentFiles.splice(index, 1)
  recentFiles.unshift(filePath)
  if (recentFiles.length > MAX_RECENT_FILES) recentFiles.length = MAX_RECENT_FILES
}

async function readTextFile(
  filePath: string,
  requested: FileEncoding = 'auto'
): Promise<OpenedFile> {
  const stat = await fs.stat(filePath)
  if (!stat.isFile()) throw new Error('所选路径不是文件')

  const handle = await fs.open(filePath, 'r')
  try {
    const bytesToRead = Math.min(stat.size, MAX_TEXT_BYTES)
    const buffer = Buffer.alloc(bytesToRead)
    await handle.read(buffer, 0, bytesToRead, 0)
    const { content, encoding } = decodeText(buffer, requested)
    return {
      path: filePath,
      name: basename(filePath),
      content,
      bytes: stat.size,
      truncated: stat.size > MAX_TEXT_BYTES,
      encoding
    }
  } finally {
    await handle.close()
  }
}

export function registerFileHandlers(): void {
  registerGuardedHandler('file:open', async (_event, encoding?: FileEncoding) => {
    const result = await dialog.showOpenDialog({
      title: '打开文件',
      properties: ['openFile'],
      filters: [
        { name: '文本与数据文件', extensions: TEXT_EXTENSIONS },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const opened = await readTextFile(result.filePaths[0], encoding ?? 'auto')
    rememberFile(opened.path)
    return opened
  })

  // Only files the user picked through the dialog (or that stayed in the recent
  // list) are readable without a second confirmation.
  registerGuardedHandler('file:read', async (_event, filePath: string, encoding?: FileEncoding) => {
    if (!recentFiles.includes(filePath)) {
      throw new Error('该文件尚未通过打开对话框选择')
    }
    return readTextFile(filePath, encoding ?? 'auto')
  })

  registerGuardedHandler(
    'file:save',
    async (_event, options: { content: string; suggestedName?: string; filePath?: string }) => {
      let targetPath = options.filePath
      // Overwriting is only allowed for a path the renderer got from a native
      // dialog, otherwise a compromised renderer could write anywhere.
      if (targetPath && !recentFiles.includes(targetPath)) {
        throw new Error('该文件尚未通过打开或保存对话框确认')
      }
      if (!targetPath) {
        const defaultName = options.suggestedName || 'untitled.txt'
        const result = await dialog.showSaveDialog({
          title: '保存文件',
          defaultPath: defaultName,
          filters: [
            {
              name: '文本与数据文件',
              extensions: [extname(defaultName).replace('.', '') || 'txt']
            },
            { name: '所有文件', extensions: ['*'] }
          ]
        })
        if (result.canceled || !result.filePath) {
          return { path: '', name: '', bytes: 0, canceled: true } satisfies SaveFileResult
        }
        targetPath = result.filePath
      }

      await fs.writeFile(targetPath, options.content, 'utf-8')
      rememberFile(targetPath)
      return {
        path: targetPath,
        name: basename(targetPath),
        bytes: Buffer.byteLength(options.content, 'utf-8'),
        canceled: false
      } satisfies SaveFileResult
    }
  )

  registerGuardedHandler('file:recent', () => [...recentFiles])

  registerGuardedHandler('file:reveal', async (_event, filePath: string) => {
    if (!recentFiles.includes(filePath)) return false
    shell.showItemInFolder(filePath)
    return true
  })
}
