/**
 * Runs regex matching off the UI thread.
 *
 * A user-authored pattern such as `(a+)+$` can backtrack catastrophically and
 * freeze the whole renderer for minutes. The page cancels this worker when a
 * run exceeds its time budget, which is only possible off the main thread.
 */
import {
  applyReplacement,
  collectMatchesResult,
  MAX_MATCHES,
  type MatchInfo,
  type ReplaceResult
} from '../lib/regex-match'

export interface RegexWorkerRequest {
  pattern: string
  flags: string
  input: string
  replacement: string
  mode: 'match' | 'replace'
}

export interface RegexWorkerResponse {
  matches?: MatchInfo[]
  truncated?: boolean
  replacement?: ReplaceResult | null
  error?: string
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RegexWorkerRequest>) => void) | null
  postMessage: (message: RegexWorkerResponse) => void
}

scope.onmessage = (event) => {
  const { pattern, flags, input, replacement, mode } = event.data
  try {
    const regex = new RegExp(pattern, flags)
    const collected = collectMatchesResult(regex, input, MAX_MATCHES)
    const replaced =
      mode === 'replace' ? applyReplacement(input, regex, replacement, MAX_MATCHES) : null
    scope.postMessage({
      matches: collected.matches,
      truncated: collected.truncated,
      replacement: replaced
    })
  } catch (err) {
    scope.postMessage({ error: err instanceof Error ? err.message : String(err) })
  }
}
