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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Algo deu errado</h1>
        <p className="text-sm text-slate-600 mt-2">
          Ocorreu um erro inesperado ao carregar esta página.
        </p>
        <div className="mt-4 rounded-md bg-slate-100 p-3 text-xs text-slate-700 overflow-auto">
          {message}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={resetErrorBoundary} variant="secondary">
            Tentar novamente
          </Button>
          <Button onClick={handleGoHome} variant="outline">
            Voltar ao início
          </Button>
          <Button onClick={handleReload} className="bg-slate-900 hover:bg-slate-800">
            Recarregar página
          </Button>
        </div>
      </div>
    </div>
  );
}
