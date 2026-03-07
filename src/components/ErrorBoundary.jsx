import React from 'react';
import { Button } from '@/components/ui';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Silently handle DOM manipulation errors caused by browser extensions
        if (
            error?.name === 'NotFoundError' ||
            error?.message?.includes('removeChild') ||
            error?.message?.includes('insertBefore')
        ) {
            console.warn('[ErrorBoundary] DOM manipulation error caught (likely browser extension):', error.message);
            return;
        }
        console.error('[ErrorBoundary] Unhandled component error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            // For DOM-related errors, try to silently recover
            if (
                this.state.error?.name === 'NotFoundError' ||
                this.state.error?.message?.includes('removeChild') ||
                this.state.error?.message?.includes('insertBefore')
            ) {
                // Auto-recover on next tick
                setTimeout(() => this.handleReset(), 0);
                return this.props.children;
            }

            return (
                <div className="flex flex-col items-center justify-center gap-4 p-8 text-center rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                    <div>
                        <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
                            Algo salió mal
                        </h3>
                        <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                            {this.props.fallbackMessage || 'Ocurrió un error inesperado. Intenta recargar.'}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={this.handleReset}
                        className="gap-2 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/40"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reintentar
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
