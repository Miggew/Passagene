import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false); // Mostra tela de confirmacao

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Informe seu email');
      return;
    }

    setLoading(true);

    // Envia email de recuperacao via Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // URL para onde o usuario sera redirecionado apos clicar no link do email
      // Ajuste conforme seu dominio de deploy
      redirectTo: window.location.origin + window.location.pathname,
    });

    setLoading(false);

    if (error) {
      toast.error('Erro ao enviar email: ' + error.message);
    } else {
      setSent(true);
    }
  };

  // Tela de confirmacao apos enviar email
  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">
              Email enviado!
            </h2>
            <p className="text-slate-600 mb-6">
              Se existe uma conta com <strong>{email}</strong>, voce recebera
              um link para redefinir sua senha. Verifique sua caixa de entrada e spam.
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
          <p className="text-slate-400 mt-2">Recuperar senha</p>
        </div>

        {/* Card do formulario */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-2 text-center">
            Esqueceu sua senha?
          </h2>
          <p className="text-sm text-slate-500 text-center mb-6">
            Informe seu email e enviaremos um link para redefinir sua senha.
          </p>

          <form onSubmit={handleReset} className="space-y-4">
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

            {/* Botao Enviar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Enviar link de recuperacao
                </>
              )}
            </button>
          </form>

          {/* Link voltar */}
          <Link
            to="/login"
            className="flex items-center justify-center gap-1 text-sm text-slate-600 hover:text-green-600 mt-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
