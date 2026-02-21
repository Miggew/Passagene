import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { LogoPassagene } from '@/components/ui/LogoPassagene';

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary px-4">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <LogoPassagene height={48} variant="premium" />
        </div>

        <div className="flex justify-center mb-6">
          <div className="p-4 bg-destructive/10 rounded-full">
            <ShieldX className="h-16 w-16 text-destructive" />
          </div>
        </div>

        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
          Acesso Negado
        </h1>

        <p className="text-muted-foreground mb-6">
          {profile ? (
            <>
              Olá, <strong className="text-foreground">{profile.nome}</strong>. Você não tem permissão para acessar esta área.
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
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Ir para o início
          </Button>
        </div>
      </div>
    </div>
  );
}
