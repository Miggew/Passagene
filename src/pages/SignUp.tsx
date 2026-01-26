import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false); // Mostra mensagem de sucesso

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validacoes
    if (!email.trim() || !password || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas nao coincidem');
      return;
    }

    setLoading(true);

    // Cria a conta no Supabase
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Este email ja esta cadastrado');
      } else {
        toast.error('Erro ao criar conta: ' + error.message);
      }
    } else {
      // Sucesso! Mostra mensagem para verificar email
      setSuccess(true);
    }
  };

  // Tela de sucesso apos cadastro
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">
              Conta criada!
            </h2>
            <p className="text-slate-600 mb-6">
              Enviamos um link de confirmacao para <strong>{email}</strong>.
              Verifique sua caixa de entrada (e spam) para ativar sua conta.
            </p>
            <Link
              to="/login"
              className="inline-block bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Voltar ao Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Cabecalho */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-400">FIV/TE Bovina</h1>
          <p className="text-slate-400 mt-2">Criar nova conta</p>
        </div>

        {/* Card do formulario */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6 text-center">
            Cadastro
          </h2>

          <form onSubmit={handleSignUp} className="space-y-4">
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
                Senha (minimo 6 caracteres)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Crie uma senha"
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

            {/* Confirmar Senha */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirmar senha
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                disabled={loading}
              />
            </div>

            {/* Botao Cadastrar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Criar conta
                </>
              )}
            </button>
          </form>

          {/* Link para login */}
          <p className="text-center text-sm text-slate-600 mt-6">
            Ja tem uma conta?{' '}
            <Link to="/login" className="text-green-600 font-medium hover:underline">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
