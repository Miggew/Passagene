import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';

export default function SemAcesso() {
  const navigate = useNavigate();
  const { getDefaultRoute, profile } = usePermissions();

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    const defaultRoute = getDefaultRoute();
    navigate(defaultRoute);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-red-100 rounded-full">
            <ShieldX className="h-16 w-16 text-red-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Acesso Negado
        </h1>

        <p className="text-slate-600 mb-6">
          {profile ? (
            <>
              Olá, <strong>{profile.nome}</strong>. Você não tem permissão para acessar esta área.
              Entre em contato com o administrador se precisar de acesso.
            </>
          ) : (
            'Você não tem permissão para acessar esta área.'
          )}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          <Button
            onClick={handleGoHome}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Home className="h-4 w-4" />
            Ir para o início
          </Button>
        </div>
      </div>
    </div>
  );
}
