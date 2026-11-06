import { describe, expect, it, vi } from 'vitest'
import { createRefreshingFetch } from './refreshingFetch'

const expired = () => new Response(JSON.stringify({ code: 'PGRST303', message: 'JWT expired' }), { status: 401 })
const ok = () => new Response('[]', { status: 200 })
const url = 'https://x.supabase.co/rest/v1/gardens'
const init = { method: 'POST', body: '{}', headers: { Authorization: 'Bearer velho', apikey: 'k' } }

describe('createRefreshingFetch', () => {
  it('renova e repete com o token novo quando o JWT venceu', async () => {
    const base = vi.fn<typeof fetch>().mockResolvedValueOnce(expired()).mockResolvedValueOnce(ok())
    const refresh = vi.fn(async () => 'novo')

    const response = await createRefreshingFetch(refresh, base)(url, init)

    expect(response.status).toBe(200)
    expect(refresh).toHaveBeenCalledTimes(1)
    const retried = base.mock.calls[1][1]
    const headers = new Headers(retried?.headers)
    expect(headers.get('Authorization')).toBe('Bearer novo')
    expect(headers.get('apikey')).toBe('k')
    expect(retried?.body).toBe('{}')
  })

  it('não mexe em respostas normais nem em outros 401', async () => {
    const other = new Response(JSON.stringify({ code: '42501', message: 'negado' }), { status: 401 })
    const base = vi.fn<typeof fetch>().mockResolvedValueOnce(ok()).mockResolvedValueOnce(other)
    const refresh = vi.fn(async () => 'novo')
    const wrapped = createRefreshingFetch(refresh, base)

    expect((await wrapped(url, init)).status).toBe(200)
    expect((await wrapped(url, init)).status).toBe(401)
    expect(refresh).not.toHaveBeenCalled()
    expect(base).toHaveBeenCalledTimes(2)
  })

  it('devolve o erro original, ainda legível, se não conseguir renovar', async () => {
    const base = vi.fn<typeof fetch>().mockImplementation(async () => expired())

    for (const refresh of [async () => null, async () => Promise.reject(new Error('offline'))]) {
      const response = await createRefreshingFetch(refresh, base)(url, init)
      expect(response.status).toBe(401)
      expect((await response.json()).message).toBe('JWT expired')
    }
    expect(base).toHaveBeenCalledTimes(2) // nenhuma repetição
  })

  it('repete só uma vez, mesmo que o token novo também seja recusado', async () => {
    const base = vi.fn<typeof fetch>().mockImplementation(async () => expired())

    const response = await createRefreshingFetch(async () => 'novo', base)(url, init)

    expect(response.status).toBe(401)
    expect(base).toHaveBeenCalledTimes(2)
  })

  it('chamadas simultâneas dividem a mesma renovação', async () => {
    const base = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_input, options) =>
        new Headers(options?.headers).get('Authorization') === 'Bearer novo' ? ok() : expired(),
      )
    const refresh = vi.fn(async () => 'novo')
    const wrapped = createRefreshingFetch(refresh, base)

    const responses = await Promise.all([wrapped(url, init), wrapped(url, init), wrapped(url, init)])

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200])
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
