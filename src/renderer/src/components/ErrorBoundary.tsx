import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="error-boundary">
          <div className="error-content">
            <h2>出错了</h2>
            <p>页面加载失败，请刷新重试</p>
            {this.state.error && (
              <details>
                <summary>错误详情</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            )}
            <button onClick={() => window.location.reload()} className="btn-primary">
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
