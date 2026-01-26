import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Evita reload da pagina

    // Validacao basica
    if (!email.trim() || !password.trim()) {
      toast.error('Preencha email e senha');
      return;
    }

    setLoading(true);

    // Tenta fazer login no Supabase
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      // Mensagens de erro amigaveis em portugues
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Confirme seu email antes de fazer login');
      } else {
        toast.error('Erro ao fazer login: ' + error.message);
      }
    }
    // Se login OK, o AuthContext detecta automaticamente via onAuthStateChange
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Cabecalho */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-400">FIV/TE Bovina</h1>
          <p className="text-slate-400 mt-2">Sistema de Controle</p>
        </div>

        {/* Card do formulario */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6 text-center">
            Entrar na sua conta
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Campo Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                disabled={loading}
              />
            </div>

            {/* Campo Senha */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Link recuperar senha */}
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-green-600 hover:text-green-700 hover:underline"
              >
                Esqueceu a senha?
              </Link>
            </div>

            {/* Botao Login */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Entrar
                </>
              )}
            </button>
          </form>

          {/* Link para cadastro */}
          <p className="text-center text-sm text-slate-600 mt-6">
            Nao tem conta?{' '}
            <Link to="/signup" className="text-green-600 font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
