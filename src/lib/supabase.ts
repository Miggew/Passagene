import { createClient } from '@supabase/supabase-js';

// Usar variáveis de ambiente se disponíveis, caso contrário usar valores padrão
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://twsnzfzjtjdamwwembzp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3c256ZnpqdGpkYW13d2VtYnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMDczODEsImV4cCI6MjA4Mjg4MzM4MX0.EFmjLPT_Mnl4cv2qcH5vq5_zmo47fGWFjQdGGwidsNY';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Erro: Configuração do Supabase não encontrada!');
  console.error('Verifique se as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidas.');
}

// Criar cliente com opções de retry e timeout
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-client-info': 'passagene@1.0.0',
    },
  },
  // Configurações para melhor tratamento de erros de rede
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Função para testar conexão
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('clientes').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned, não é erro de conexão
      console.error('❌ Erro ao conectar com Supabase:', error);
      return false;
    }
    console.log('✅ Conexão com Supabase estabelecida com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro de rede ao conectar com Supabase:', error);
    return false;
  }
};