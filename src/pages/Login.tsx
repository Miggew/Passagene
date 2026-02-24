import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogoPassagene } from '@/components/ui/LogoPassagene';
import { LoaderDNA } from '@/components/ui/LoaderDNA';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error('Preencha email e senha');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Confirme seu email antes de fazer login');
      } else {
        toast.error('Erro ao fazer login: ' + error.message);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <LogoPassagene height={64} variant="premium" />
        </div>

        {/* Card do formulário */}
        <Card className="glass-panel border-border/40 shadow-xl overflow-hidden shadow-primary/5">
          <CardHeader className="text-center relative pb-8 pt-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/30 via-primary to-primary/30" />
            <CardTitle className="text-2xl font-heading tracking-tight">Entrar na sua conta</CardTitle>
            <CardDescription className="text-muted-foreground/80 mt-1.5 font-medium">
              Inteligência Reprodutiva do Rebanho
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-10">
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Campo Email */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground/80 uppercase tracking-wide">
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

              {/* Campo Senha */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground/80 uppercase tracking-wide">
                  Senha
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    disabled={loading}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors hover:bg-muted/50 rounded-full"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Link recuperar senha */}
              <div className="text-right pt-1 pb-2">
                <Link
                  to="/forgot-password"
                  className="text-[13px] text-muted-foreground hover:text-foreground hover:underline transition-colors font-medium"
                >
                  Esqueceu a senha?
                </Link>
              </div>

              {/* Botão Login */}
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
                    <LogIn className="w-5 h-5" />
                    Entrar no Sistema
                  </>
                )}
              </Button>
            </form>

            {/* Link para cadastro */}
            <p className="text-center text-sm text-muted-foreground mt-8 font-medium">
              Não tem conta?{' '}
              <Link to="/signup" className="text-primary font-bold hover:underline">
                Criar conta
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
