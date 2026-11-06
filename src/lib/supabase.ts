// Cliente do Supabase: o único caminho do front até o banco.
// URL e chave vêm do .env.local. A chave "publishable" pode ficar no navegador:
// quem protege os dados é a RLS, não o segredo da chave.
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { createRefreshingFetch } from './refreshingFetch'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

/** Sem as variáveis, o app mostra a tela de configuração em vez de quebrar. */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)

async function refreshAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.refreshSession()
  return data.session?.access_token ?? null
}

export const supabase = createClient<Database>(SUPABASE_URL || 'http://localhost', SUPABASE_KEY || 'sem-chave', {
  global: { fetch: createRefreshingFetch(refreshAccessToken) },
})
