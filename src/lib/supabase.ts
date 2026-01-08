import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://twsnzfzjtjdamwwembzp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3c256ZnpqdGpkYW13d2VtYnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMDczODEsImV4cCI6MjA4Mjg4MzM4MX0.EFmjLPT_Mnl4cv2qcH5vq5_zmo47fGWFjQdGGwidsNY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);