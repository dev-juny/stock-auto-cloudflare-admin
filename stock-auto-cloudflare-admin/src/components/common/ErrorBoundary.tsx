import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
    this.props.onError?.(error, errorInfo)
    try {
      const body = JSON.stringify({
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      })
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'ERROR',
          source: 'ErrorBoundary',
          message: `UI Error: ${error.message}`,
          context: body,
        }),
      }).catch(() => {})
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 max-w-md w-full text-center">
            <AlertTriangle size={32} className="mx-auto mb-3 text-red-400" />
            <h2 className="text-sm font-bold text-text mb-2">Unexpected Error</h2>
            <p className="text-xs text-text-muted mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors mx-auto"
            >
              <RefreshCw size={12} /> Reload Page
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
              }}
              className="block text-xs text-text-muted hover:text-text mt-2 mx-auto"
            >
              Dismiss
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
