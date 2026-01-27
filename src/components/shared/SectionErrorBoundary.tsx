/**
 * SectionErrorBoundary - Error Boundary para seções da página
 * Isola erros em componentes específicos sem quebrar a página toda
 */

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  showError?: boolean;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SectionErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const {
        fallbackTitle = 'Erro ao carregar',
        fallbackMessage = 'Ocorreu um erro ao carregar esta seção.',
        showError = false,
      } = this.props;

      return (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-red-900">{fallbackTitle}</h3>
              <p className="text-sm text-red-700 mt-1 max-w-md">{fallbackMessage}</p>

              {showError && this.state.error && (
                <div className="mt-4 p-3 bg-red-100 rounded-md text-xs text-red-800 max-w-md overflow-auto">
                  {this.state.error.message}
                </div>
              )}

              <Button
                onClick={this.handleReset}
                variant="outline"
                className="mt-4 border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC para envolver componentes com error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  return function WithErrorBoundary(props: P) {
    return (
      <SectionErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </SectionErrorBoundary>
    );
  };
}

/**
 * Componente funcional wrapper para uso mais simples
 */
export function ErrorBoundary({
  children,
  ...props
}: Props) {
  return <SectionErrorBoundary {...props}>{children}</SectionErrorBoundary>;
}

export default SectionErrorBoundary;
