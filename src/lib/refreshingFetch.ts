// Plano B do login: o supabase-js renova o token olhando o relógio do aparelho. Se esse
// relógio estiver atrasado (ou o PC acabou de acordar), ele manda um token que o servidor
// já considera vencido. Aqui, quando o servidor recusa por isso, renovamos e repetimos.
// Repetir é seguro: o token é checado antes de a chamada executar qualquer coisa no banco.

type Refresh = () => Promise<string | null>

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
  const refreshOnce = () => (pending ??= refresh().finally(() => (pending = null)))

  return async (input, init) => {
    const response = await baseFetch(input, init)
    // Um Request já consumido não pode ser reenviado; o supabase-js sempre manda URL + init.
    if (input instanceof Request || !(await isJwtExpired(response))) return response

    const token = await refreshOnce().catch(() => null)
    if (!token) return response // sem renovar: devolve o erro original

    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return baseFetch(input, { ...init, headers }) // só uma repetição, sem laço
  }
}
