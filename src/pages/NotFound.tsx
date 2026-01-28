import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';
import logoEscrito from '@/assets/logoescrito.svg';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-secondary p-6 text-center">
      <div className="space-y-6 max-w-md">
        {/* Logo */}
        <img src={logoEscrito} alt="PassaGene" className="h-12 w-auto mx-auto mb-4" />

        <div className="space-y-3">
          <h1 className="text-8xl font-bold text-primary">404</h1>
          <h2 className="font-heading text-2xl font-semibold text-foreground">Página não encontrada</h2>
          <p className="text-muted-foreground">A página que você procura não existe ou foi movida.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <a href="/">
              <Home className="w-4 h-4 mr-2" />
              Voltar ao início
            </a>
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
