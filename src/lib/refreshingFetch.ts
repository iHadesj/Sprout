// Plano B do login: o supabase-js renova o token olhando o relógio do aparelho. Se esse
// relógio estiver atrasado (ou o PC acabou de acordar), ele manda um token que o servidor
// já considera vencido. Aqui, quando o servidor recusa por isso, renovamos e repetimos.
// Repetir é seguro: o token é checado antes de a chamada executar qualquer coisa no banco.
import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'

type Refresh = (rejectedToken: string | null) => Promise<string | null>
type Auth = Pick<SupabaseClient['auth'], 'refreshSession' | 'getSession' | 'signOut'>

/**
 * Consegue um token novo depois que o servidor recusou `rejectedToken`.
 * Se a renovação falhar, sobram três casos:
 * - outra aba já renovou: o token novo está salvo, é só usar;
 * - sem rede: mantém o login e deixa o erro aparecer (a próxima tentativa resolve);
 * - a sessão morreu: desloga. Com o relógio atrasado o supabase-js ainda acha que o token
 *   vale e guarda a sessão, e o app ficaria preso no erro em vez de voltar pro login.
 */
export async function renewToken(auth: Auth, rejectedToken: string | null): Promise<string | null> {
  const { data, error } = await auth.refreshSession()
  if (data.session) return data.session.access_token

  const { session } = (await auth.getSession()).data
  if (session && session.access_token !== rejectedToken) return session.access_token

  // sem await: o logout passa por este mesmo fetch, e esperar por ele aqui travaria a renovação
  if (error && !isAuthRetryableFetchError(error)) void auth.signOut({ scope: 'local' })
  return null
}

/** O PostgREST responde 401 com o código PGRST303 (ou a mensagem) quando o token venceu. */
async function isJwtExpired(response: Response): Promise<boolean> {
  if (response.status !== 401) return false
  try {
    // clone: quem chamou ainda precisa conseguir ler o corpo original
    const body = (await response.clone().json()) as { code?: string; message?: string }
    return body.code === 'PGRST303' || body.message === 'JWT expired'
  } catch {
    return false
  }
}

export function createRefreshingFetch(
  refresh: Refresh,
  baseFetch: typeof fetch = (...args) => fetch(...args),
): typeof fetch {
  // Várias telas pedem dados juntas: todas esperam a mesma renovação, em vez de uma por chamada.
  let pending: Promise<string | null> | null = null
  const refreshOnce = (rejectedToken: string | null) =>
    (pending ??= refresh(rejectedToken).finally(() => (pending = null)))

  return async (input, init) => {
    const response = await baseFetch(input, init)
    // Um Request já consumido não pode ser reenviado; o supabase-js sempre manda URL + init.
    if (input instanceof Request || !(await isJwtExpired(response))) return response

    const headers = new Headers(init?.headers)
    const rejectedToken = headers.get('Authorization')?.replace('Bearer ', '') ?? null
    const token = await refreshOnce(rejectedToken).catch(() => null)
    if (!token) return response // sem renovar: devolve o erro original

    headers.set('Authorization', `Bearer ${token}`)
    return baseFetch(input, { ...init, headers }) // só uma repetição, sem laço
  }
}
