import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 16,
            padding: 32,
            color: 'var(--color-text)',
          }}
        >
          <div style={{ fontSize: 40 }}>⚒️</div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            Something went wrong / 出错了
          </div>
          {this.state.error && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--color-text-dim)',
                fontFamily: 'monospace',
                maxWidth: 400,
                textAlign: 'center',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-accent)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Retry / 重试
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'transparent',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Reload / 重载
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
