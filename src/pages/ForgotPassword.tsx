import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogoPassagene } from '@/components/ui/LogoPassagene';
import { LoaderDNA } from '@/components/ui/LoaderDNA';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Informe seu email');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    });

    setLoading(false);

    if (error) {
      toast.error('Erro ao enviar email: ' + error.message);
    } else {
      setSent(true);
    }
  };

  // Tela de confirmação após enviar email
  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <LogoPassagene height={64} variant="premium" />
          </div>

          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 bg-primary-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
                Email enviado!
              </h2>
              <p className="text-muted-foreground mb-6">
                Se existe uma conta com <strong className="text-foreground">{email}</strong>, você receberá
                um link para redefinir sua senha. Verifique sua caixa de entrada e spam.
              </p>
              <Button asChild>
                <Link to="/login">Voltar ao Login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <LogoPassagene height={64} variant="premium" />
        </div>

        {/* Card do formulário */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Esqueceu sua senha?</CardTitle>
            <CardDescription>
              Informe seu email e enviaremos um link para redefinir sua senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReset} className="space-y-4">
              {/* Campo Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={loading}
                />
              </div>

              {/* Botão Enviar */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <LoaderDNA size={24} variant="premium" />
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Enviar link de recuperação
                  </>
                )}
              </Button>
            </form>

            {/* Link voltar */}
            <Link
              to="/login"
              className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary mt-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
