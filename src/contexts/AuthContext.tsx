import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Tipos do contexto de autenticacao
interface AuthContextType {
  user: User | null;        // Usuario logado (ou null se nao logado)
  session: Session | null;  // Sessao ativa do Supabase
  loading: boolean;         // true enquanto verifica se ha sessao salva
  signOut: () => Promise<void>; // Funcao de logout
}

// Cria o contexto (undefined como valor inicial)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider que envolve o app e gerencia o estado de autenticacao
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true); // Comeca carregando

  useEffect(() => {
    // 1. Busca a sessao atual (caso o usuario ja esteja logado)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // Terminou de verificar
    });

    // 2. Escuta mudancas na autenticacao em tempo real
    //    (login, logout, token renovado, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // 3. Limpa o listener quando o componente desmonta
    return () => subscription.unsubscribe();
  }, []);

  // Funcao de logout
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook para usar o contexto de auth em qualquer componente
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
