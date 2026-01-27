import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserPermissions, Hub } from '@/lib/types';

// Tipos do contexto de autenticacao
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  permissions: UserPermissions | null;
  permissionsLoading: boolean;
  hubs: Hub[];
  signOut: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  hasAccessToHub: (hubCode: string) => boolean;
  hasAccessToRoute: (route: string) => boolean;
}

// Cria o contexto (undefined como valor inicial)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider que envolve o app e gerencia o estado de autenticacao
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [hubs, setHubs] = useState<Hub[]>([]);

  // Carrega os hubs disponíveis
  const loadHubs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('hubs')
        .select('*')
        .order('display_order');

      if (!error && data) {
        setHubs(data);
        return data;
      }
      return [];
    } catch (e) {
      console.error('[Auth] Erro ao carregar hubs:', e);
      return [];
    }
  }, []);

  // Carrega o perfil e permissões do usuário
  const loadUserPermissions = useCallback(async (userId: string): Promise<UserPermissions | null> => {
    try {
      // Busca o perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        console.error('[Auth] Erro ao carregar perfil:', profileError);
        return null;
      }

      // Se for admin, tem acesso a todos os hubs
      if (profile.user_type === 'admin') {
        const { data: allHubs } = await supabase
          .from('hubs')
          .select('code')
          .order('display_order');

        return {
          profile,
          allowedHubs: allHubs?.map(h => h.code) || [],
          isAdmin: true,
          isCliente: false,
        };
      }

      // Se for cliente, acesso apenas ao portal
      if (profile.user_type === 'cliente') {
        return {
          profile,
          allowedHubs: ['portal'],
          isAdmin: false,
          isCliente: true,
        };
      }

      // Se for operacional, busca permissões específicas
      const { data: hubPermissions } = await supabase
        .from('user_hub_permissions')
        .select('hub_code')
        .eq('user_id', userId)
        .eq('can_access', true);

      return {
        profile,
        allowedHubs: hubPermissions?.map(p => p.hub_code) || [],
        isAdmin: false,
        isCliente: false,
      };
    } catch (error) {
      console.error('[Auth] Erro ao carregar permissões:', error);
      return null;
    }
  }, []);

  // Atualiza as permissões (chamado após login ou manualmente)
  const refreshPermissions = useCallback(async () => {
    if (!user) return;

    setPermissionsLoading(true);
    try {
      await loadHubs();
      const perms = await loadUserPermissions(user.id);
      setPermissions(perms);
    } finally {
      setPermissionsLoading(false);
    }
  }, [user, loadHubs, loadUserPermissions]);

  // Verifica se tem acesso a um hub específico
  const hasAccessToHub = useCallback((hubCode: string): boolean => {
    if (!permissions) return false;
    if (permissions.isAdmin) return true;
    return permissions.allowedHubs.includes(hubCode);
  }, [permissions]);

  // Verifica se tem acesso a uma rota específica
  const hasAccessToRoute = useCallback((route: string): boolean => {
    if (!permissions) return false;
    if (permissions.isAdmin) return true;

    const hub = hubs.find(h =>
      h.routes.some(r => route.startsWith(r))
    );

    if (!hub) return true;
    return permissions.allowedHubs.includes(hub.code);
  }, [permissions, hubs]);

  // Efeito principal - igual ao original que funcionava
  useEffect(() => {
    // 1. Busca a sessao atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Escuta mudancas na autenticacao
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Efeito separado para carregar permissões quando user mudar
  useEffect(() => {
    if (user) {
      refreshPermissions();
    } else {
      setPermissions(null);
      setHubs([]);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Funcao de logout
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setPermissions(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      permissions,
      permissionsLoading,
      hubs,
      signOut,
      refreshPermissions,
      hasAccessToHub,
      hasAccessToRoute,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook para usar o contexto
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
