import { createClient } from '@supabase/supabase-js';

// Chaves de ambiente (.env local / Vercel env vars)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verifica se as chaves existem (evita erros)
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Erro: Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
}

// Cria a conexão com o Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);