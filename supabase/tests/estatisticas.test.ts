import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ageSession, as, createDb, createGarden, createUser, rpc } from './db.ts'

let db: PGlite
beforeAll(async () => {
  db = await createDb()
}, 60_000)

/** Sessão concluída e avaliada; `daysAgo` empurra o fim pra dias atrás (no relógio do banco). */
async function honestSession(user: string, gardenId: string, rating = 'sim', daysAgo = 0, distraction: string | null = null) {
  const s = await rpc<{ id: string; planned_minutes: number }>(db, user, 'start_session', { p_garden_id: gardenId })
  await ageSession(db, s.id, s.planned_minutes)
  await rpc(db, user, 'finish_session', { p_session_id: s.id, p_exits: 0 })
  await rpc(db, user, 'rate_session', { p_session_id: s.id, p_focus_rating: rating, p_distraction: distraction })
  if (daysAgo) {
    await db.query(`update sessions set ended_at = ended_at - make_interval(days => $2) where id = $1`, [s.id, daysAgo])
  }
  return s
}

describe('estatísticas', () => {
  it('cada um só vê as próprias estatísticas (views respeitam a RLS)', async () => {
    const a = await createUser(db)
    const b = await createUser(db)
    const garden = await createGarden(db, a)
    await honestSession(a, garden.id)
    const seen = await as(db, b, async (tx) => ({
      days: (await tx.query('select * from focus_days')).rows.length,
      gardens: (await tx.query('select * from garden_stats')).rows.length,
      streaks: (await tx.query('select * from user_streaks')).rows.length,
    }))
    expect(seen).toEqual({ days: 0, gardens: 0, streaks: 0 })
  })

  it('visitante sem login não lê as views', async () => {
    await expect(as(db, null, (tx) => tx.query('select * from garden_stats'))).rejects.toMatchObject({ code: '42501' })
  })

  it('resumo do jardim soma minutos e conta desfechos e "não" assumidos', async () => {
    const user = await createUser(db)
    const garden = await createGarden(db, user)
    await honestSession(user, garden.id, 'sim')
    await honestSession(user, garden.id, 'nao')
    const failed = await rpc<{ id: string }>(db, user, 'start_session', { p_garden_id: garden.id })
    await rpc(db, user, 'fail_session', { p_session_id: failed.id, p_reason: 'gave_up' })

    const stats = await as(db, user, async (tx) => (await tx.query('select * from garden_stats where garden_id = $1', [garden.id])).rows[0])
    expect(stats).toMatchObject({ completed: 2, failed: 1, invalid: 0, minutes: 50, honest_nos: 1 })
  })

  it('sequência atual e melhor sequência de dias', async () => {
    const user = await createUser(db)
    const garden = await createGarden(db, user)
    // dias 10, 9, 8 atrás (sequência de 3) e depois hoje e ontem (sequência atual de 2)
    for (const daysAgo of [10, 9, 8, 1, 0]) await honestSession(user, garden.id, 'sim', daysAgo)
    const streak = await as(db, user, async (tx) => (await tx.query('select current_streak, best_streak from user_streaks')).rows[0])
    expect(streak).toEqual({ current_streak: 2, best_streak: 3 })
  })

  it('sequência quebra se o último dia foi anteontem', async () => {
    const user = await createUser(db)
    const garden = await createGarden(db, user)
    for (const daysAgo of [4, 3, 2]) await honestSession(user, garden.id, 'sim', daysAgo)
    const streak = await as(db, user, async (tx) => (await tx.query('select current_streak, best_streak from user_streaks')).rows[0])
    expect(streak).toEqual({ current_streak: 0, best_streak: 3 })
  })

  it('distrações agrupadas por motivo e hora', async () => {
    const user = await createUser(db)
    const garden = await createGarden(db, user)
    await honestSession(user, garden.id, 'medio', 0, 'celular')
    await honestSession(user, garden.id, 'nao', 0, 'celular')
    await honestSession(user, garden.id, 'nao', 0, 'fome')
    const rows = await as(db, user, async (tx) =>
      (await tx.query<{ tag: string; count: number }>('select tag, sum(count)::int as count from distraction_stats group by tag order by tag')).rows,
    )
    expect(rows).toEqual([
      { tag: 'celular', count: 2 },
      { tag: 'fome', count: 1 },
    ])
  })
})
