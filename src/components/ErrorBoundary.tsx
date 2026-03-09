import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
    children?: ReactNode
    fallback?: ReactNode
    isFullPage?: boolean
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo)
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            const isFullPage = this.props.isFullPage ?? true

            if (!isFullPage) {
                return (
                    <div className="flex flex-col items-center justify-center p-6 bg-[var(--color-surface-2)] border border-[var(--color-danger)]/30 rounded-lg text-center gap-3">
                        <AlertTriangle className="h-6 w-6 text-[var(--color-danger)]" />
                        <div className="text-sm font-medium text-[var(--color-text)]">Component Error</div>
                        <p className="text-xs text-[var(--color-text-muted)] max-w-sm">
                            {this.state.error?.message || 'This part of the application failed to load.'}
                        </p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="mt-2 px-3 py-1.5 bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-text)] rounded text-xs transition-colors border border-[var(--color-border)]"
                        >
                            Try Again
                        </button>
                    </div>
                )
            }

            return (
                <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)] p-8">
                    <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-danger)]/30 rounded-xl p-6 shadow-xl space-y-4">
                        <div className="flex items-center gap-3 text-[var(--color-danger)]">
                            <AlertTriangle className="h-6 w-6" />
                            <h1 className="text-lg font-bold">Something went wrong</h1>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            The application encountered a critical error.
                        </p>
                        <div className="bg-[var(--color-surface-2)] p-3 rounded-lg overflow-auto max-h-48">
                            <pre className="text-xs font-mono text-[var(--color-danger)] whitespace-pre-wrap break-words">
                                {this.state.error?.message}
                                {'\n'}
                                {this.state.error?.stack}
                            </pre>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Reload Application
                        </button>
                        <button
                            onClick={() => {
                                // Emergency reset: clear IDB and LocalStorage
                                localStorage.clear();
                                indexedDB.deleteDatabase('gitshelf-db');
                                window.location.reload();
                            }}
                            className="w-full py-2.5 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] rounded-lg text-sm font-medium transition-colors"
                        >
                            Reset Data & Reload
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
