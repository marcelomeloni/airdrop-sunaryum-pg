

// Use o caminho completo do ESM CDN
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Exporte como um objeto global para facilitar o acesso
const supabase = createClient(supabaseUrl, supabaseKey)
export { supabase }
