import type { FallbackProps } from 'react-error-boundary';

import { Button } from '@/components/ui/button';

export default function AppErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error?.message || 'Erro inesperado';

  const handleGoHome = () => {
    window.location.hash = '#/';
    resetErrorBoundary();
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-6">
      <div className="max-w-lg w-full glass-panel border border-border rounded-2xl p-6 shadow-md">
        <h1 className="font-heading text-xl font-semibold text-foreground">Algo deu errado</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Ocorreu um erro inesperado ao carregar esta página.
        </p>
        <div className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground overflow-auto">
          {message}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={resetErrorBoundary} variant="secondary">
            Tentar novamente
          </Button>
          <Button onClick={handleGoHome} variant="outline">
            Voltar ao início
          </Button>
          <Button onClick={handleReload}>
            Recarregar página
          </Button>
        </div>
      </div>
    </div>
  );
}
