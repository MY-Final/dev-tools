import { useEffect, useRef, useState } from 'react'
import RegexRunnerWorker from '../workers/regex-runner.worker?worker'
import type { MatchInfo, ReplaceResult } from './regex-match'

/** A pattern that cannot finish in this budget is treated as pathological. */
export const REGEX_RUN_TIMEOUT_MS = 1500

/** Small delay so typing a pattern does not spawn a worker per keystroke. */
const DEBOUNCE_MS = 120

export interface RegexRunResult {
  matches: MatchInfo[]
  truncated: boolean
  replacement: ReplaceResult | null
}

export type RegexRunStatus = 'idle' | 'running' | 'done' | 'timeout' | 'error'

export interface RegexRunState {
  status: RegexRunStatus
  result: RegexRunResult | null
  error: string
}

interface RegexRunArgs {
  pattern: string
  flags: string
  input: string
  replacement: string
  mode: 'match' | 'replace'
}

const IDLE: RegexRunState = { status: 'idle', result: null, error: '' }

interface WorkerPayload {
  matches?: MatchInfo[]
  truncated?: boolean
  replacement?: ReplaceResult | null
  error?: string
}

/**
 * Evaluates a regex in a worker with a hard time limit. The previous result is
 * kept while a new run is in flight so highlights do not blink on every key.
 */
export function useRegexRun({
  pattern,
  flags,
  input,
  replacement,
  mode
}: RegexRunArgs): RegexRunState {
  const [state, setState] = useState<RegexRunState>(IDLE)
  const runRef = useRef(0)

  useEffect(() => {
    const runId = ++runRef.current
    let worker: Worker | null = null
    let timeoutId = 0

    const start = window.setTimeout(() => {
      if (runRef.current !== runId) return
      if (!pattern || !input) {
        setState(IDLE)
        return
      }

      worker = new RegexRunnerWorker()
      setState((prev) => ({ ...prev, status: 'running', error: '' }))

      timeoutId = window.setTimeout(() => {
        if (runRef.current !== runId) return
        worker?.terminate()
        worker = null
        setState({ status: 'timeout', result: null, error: '' })
      }, REGEX_RUN_TIMEOUT_MS)

      worker.onmessage = (event: MessageEvent<WorkerPayload>) => {
        if (runRef.current !== runId) return
        window.clearTimeout(timeoutId)
        worker?.terminate()
        worker = null
        const data = event.data
        if (data.error) {
          setState({ status: 'error', result: null, error: data.error })
          return
        }
        setState({
          status: 'done',
          result: {
            matches: data.matches ?? [],
            truncated: data.truncated ?? false,
            replacement: data.replacement ?? null
          },
          error: ''
        })
      }

      worker.onerror = (event) => {
        if (runRef.current !== runId) return
        window.clearTimeout(timeoutId)
        worker?.terminate()
        worker = null
        setState({
          status: 'error',
          result: null,
          error: event.message || '正则计算失败'
        })
      }

      worker.postMessage({ pattern, flags, input, replacement, mode })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(start)
      window.clearTimeout(timeoutId)
      worker?.terminate()
      worker = null
    }
  }, [pattern, flags, input, replacement, mode])

  return state
}
