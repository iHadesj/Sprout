import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ageSession, as, createDb, createGarden, createUser, rpc } from './db.ts'

interface Session {
  id: string
  plant_id: string
  status: string
  fail_reason: string | null
  planned_minutes: number
  started_at: Date
  ended_at: Date | null
  focus_rating: string | null
  growth_points: number | null
}
interface Plant {
  id: string
  growth: number
  status: string
  position_x: number
  position_z: number
}
interface RatingResult {
  points: number
  outcome: string
  plant_growth: number
  plant_status: string
}

let db: PGlite
beforeAll(async () => {
  db = await createDb()
}, 60_000)

async function plant(id: string): Promise<Plant> {
  const { rows } = await db.query<Plant>('select * from plants where id = $1', [id])
  return rows[0]
}
async function session(id: string): Promise<Session> {
  const { rows } = await db.query<Session>('select * from sessions where id = $1', [id])
  return rows[0]
}

/** Usuário com um jardim de 25 min e uma sessão já começada. */
async function startedSession(focusMinutes = 25) {
  const user = await createUser(db)
  const garden = await createGarden(db, user, { focus_minutes: focusMinutes })
  const s = await rpc<Session>(db, user, 'start_session', { p_garden_id: garden.id })
  return { user, garden, s }
}

/** Sessão que durou o tempo certo e foi concluída pelo servidor. */
async function completedSession(user: string, gardenId: string) {
  const s = await rpc<Session>(db, user, 'start_session', { p_garden_id: gardenId })
  await ageSession(db, s.id, s.planned_minutes)
  return rpc<Session>(db, user, 'finish_session', { p_session_id: s.id, p_exits: 0 })
}

describe('Fase 2 · o tempo da sessão é medido só pelo banco', () => {
  it('nenhuma função recebe horário do navegador', async () => {
    const { rows } = await db.query<{ args: string }>(
      `select pg_get_function_arguments(oid) as args from pg_proc
        where proname in ('start_session', 'session_heartbeat', 'finish_session', 'rate_session',
                          'fail_session', 'invalidate_session', 'expire_stale_sessions')`,
    )
    expect(rows).toHaveLength(7)
    for (const { args } of rows) expect(args).not.toMatch(/time|date|interval/)
  })

  it('o início é o now() do banco', async () => {
    const { s } = await startedSession()
    const { rows } = await db.query<{ diff: number }>(
      'select abs(extract(epoch from now() - started_at))::float8 as diff from sessions where id = $1',
      [s.id],
    )
    expect(rows[0].diff).toBeLessThan(5)
    expect(s.status).toBe('active')
    expect(s.planned_minutes).toBe(25)
  })

  it('terminar antes do tempo invalida (sem crescer, sem morrer)', async () => {
    const { user, s } = await startedSession()
    await ageSession(db, s.id, 24)
    const done = await rpc<Session>(db, user, 'finish_session', { p_session_id: s.id, p_exits: 0 })
    expect(done.status).toBe('invalid')
    expect(done.fail_reason).toBe('bad_timing')
    expect((await plant(s.plant_id)).status).toBe('growing')
  })

  it('tolerância de 5 s pra menos: 24 min e 56 s ainda vale', async () => {
    const { user, s } = await startedSession()
    await ageSession(db, s.id, 25 - 4 / 60)
    const done = await rpc<Session>(db, user, 'finish_session', { p_session_id: s.id, p_exits: 1 })
    expect(done.status).toBe('completed')
  })

  it('terminar no tempo certo conclui', async () => {
    const { user, s } = await startedSession()
    await ageSession(db, s.id, 25)
    const done = await rpc<Session>(db, user, 'finish_session', { p_session_id: s.id, p_exits: 2 })
    expect(done.status).toBe('completed')
    expect(done.ended_at).not.toBeNull()
  })

  it('voltar até 2 h depois do fim ainda conclui (celular com o navegador no fundo)', async () => {
    const { user, s } = await startedSession()
    await ageSession(db, s.id, 25 + 90)
    const done = await rpc<Session>(db, user, 'finish_session', { p_session_id: s.id, p_exits: 0 })
    expect(done.status).toBe('completed')
  })

  it('terminar mais de 2 h depois do planejado invalida', async () => {
    const { user, s } = await startedSession()
    await ageSession(db, s.id, 25 + 125)
    const done = await rpc<Session>(db, user, 'finish_session', { p_session_id: s.id, p_exits: 0 })
    expect(done.fail_reason).toBe('bad_timing')
  })

  it('heartbeat parado no meio (página congelada no celular) não invalida', async () => {
    const { user, s } = await startedSession()
    await ageSession(db, s.id, 25, 20 * 60)
    const done = await rpc<Session>(db, user, 'finish_session', { p_session_id: s.id, p_exits: 0 })
    expect(done.status).toBe('completed')
  })

  it('o usuário não consegue mexer no started_at pra encurtar a sessão', async () => {
    const { user, s } = await startedSession()
    await expect(
      as(db, user, (tx) =>
        tx.query(`update sessions set started_at = now() - interval '1 hour' where id = $1`, [s.id]),
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('crescimento', () => {
  it('"sim" dá 2 pontos, "mais ou menos" 1, "não" 0 sem matar', async () => {
    const user = await createUser(db)
    const garden = await createGarden(db, user)
    const results: RatingResult[] = []
    for (const rating of ['sim', 'medio', 'nao']) {
      const s = await completedSession(user, garden.id)
      results.push(await rpc<RatingResult>(db, user, 'rate_session', { p_session_id: s.id, p_focus_rating: rating }))
    }
    expect(results.map((r) => r.points)).toEqual([2, 1, 0])
    expect(results.map((r) => r.plant_growth)).toEqual([2, 3, 3])
    expect(results[2].outcome).toBe('not_focused')
    expect(results[2].plant_status).toBe('growing')
  })

  it('5 sessões honestas fazem uma planta adulta; a próxima sessão planta outra semente', async () => {
    const user = await createUser(db)
    const garden = await createGarden(db, user)
    let last: RatingResult | null = null
    let firstPlant = ''
    for (let i = 0; i < 5; i++) {
      const s = await completedSession(user, garden.id)
      firstPlant ||= s.plant_id
      last = await rpc<RatingResult>(db, user, 'rate_session', { p_session_id: s.id, p_focus_rating: 'sim' })
    }
    expect(last).toMatchObject({ plant_growth: 10, plant_status: 'grown' })

    const next = await rpc<Session>(db, user, 'start_session', { p_garden_id: garden.id })
    expect(next.plant_id).not.toBe(firstPlant)
    const [a, b] = [await plant(firstPlant), await plant(next.plant_id)]
    expect(b.growth).toBe(0)
    expect(Math.hypot(a.position_x - b.position_x, a.position_z - b.position_z)).toBeGreaterThan(0.5)
  })

  it('a resposta pode vir depois: a revisão não tem prazo de 3 min', async () => {
    const user = await createUser(db)
    const garden = await createGarden(db, user)
    const s = await completedSession(user, garden.id)
    await db.query(`update sessions set ended_at = ended_at - interval '20 minutes' where id = $1`, [s.id])
    const r = await rpc<RatingResult>(db, user, 'rate_session', { p_session_id: s.id, p_focus_rating: 'sim' })
    expect(r.outcome).toBe('grew')
  })

  it('cada sessão só pode ser avaliada uma vez', async () => {
    const user = await createUser(db)
    const garden = await createGarden(db, user)
    const s = await completedSession(user, garden.id)
    await rpc(db, user, 'rate_session', { p_session_id: s.id, p_focus_rating: 'sim' })
    await expect(rpc(db, user, 'rate_session', { p_session_id: s.id, p_focus_rating: 'sim' })).rejects.toMatchObject({
      code: 'SP004',
    })
  })

  it('sessão inválida não pode ser avaliada', async () => {
    const { user, s } = await startedSession()
    await rpc(db, user, 'finish_session', { p_session_id: s.id, p_exits: 0 })
    await expect(rpc(db, user, 'rate_session', { p_session_id: s.id, p_focus_rating: 'sim' })).rejects.toMatchObject({
      code: 'SP004',
    })
  })

  it('limite diário: a 11ª sessão concluída do dia não cresce (somando todos os jardins)', async () => {
    const user = await createUser(db)
    const gardens = [await createGarden(db, user, { name: 'A' }), await createGarden(db, user, { name: 'B' })]
    const outcomes: string[] = []
    for (let i = 0; i < 11; i++) {
      const s = await completedSession(user, gardens[i % 2].id)
      const r = await rpc<RatingResult>(db, user, 'rate_session', { p_session_id: s.id, p_focus_rating: 'medio' })
      outcomes.push(r.outcome)
    }
    expect(outcomes.slice(0, 10).every((o) => o === 'grew')).toBe(true)
    expect(outcomes[10]).toBe('daily_limit')
  })

  it('o "hoje" do limite diário é o do fuso do usuário', async () => {
    const user = await createUser(db, { timezone: 'Asia/Tokyo' })
    const garden = await createGarden(db, user)
    // 10 sessões concluídas "ontem" no horário de Tóquio
    for (let i = 0; i < 10; i++) {
      const s = await completedSession(user, garden.id)
      await db.query(
        `update sessions set ended_at = date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo'
                                         - interval '1 hour' - make_interval(mins => $2)
          where id = $1`,
        [s.id, i],
      )
    }
    const today = await completedSession(user, garden.id)
    const r = await rpc<RatingResult>(db, user, 'rate_session', { p_session_id: today.id, p_focus_rating: 'sim' })
    expect(r.outcome).toBe('grew')
  })
})

describe('falha, invalidação e abandono', () => {
  it('fail_session falha a sessão e mata a planta', async () => {
    const { user, s } = await startedSession()
    await rpc(db, user, 'fail_session', { p_session_id: s.id, p_reason: 'away_too_long' })
    expect(await session(s.id)).toMatchObject({ status: 'failed', fail_reason: 'away_too_long' })
    expect((await plant(s.plant_id)).status).toBe('dead')
  })

  it('planta morta fica no jardim e a próxima sessão planta uma semente nova', async () => {
    const { user, garden, s } = await startedSession()
    await rpc(db, user, 'fail_session', { p_session_id: s.id, p_reason: 'gave_up' })
    const next = await rpc<Session>(db, user, 'start_session', { p_garden_id: garden.id })
    expect(next.plant_id).not.toBe(s.plant_id)
    expect((await plant(s.plant_id)).status).toBe('dead')
  })

  it('motivo de falha fora da lista é recusado', async () => {
    const { user, s } = await startedSession()
    await expect(rpc(db, user, 'fail_session', { p_session_id: s.id, p_reason: 'clock_changed' })).rejects.toMatchObject({
      code: 'SP005',
    })
  })

  it('relógio mexido invalida sem matar a planta', async () => {
    const { user, s } = await startedSession()
    await rpc(db, user, 'invalidate_session', { p_session_id: s.id })
    expect(await session(s.id)).toMatchObject({ status: 'invalid', fail_reason: 'clock_changed' })
    expect((await plant(s.plant_id)).status).toBe('growing')
  })

  it('só uma sessão ativa por usuário: a segunda aba não consegue começar outra', async () => {
    const { user, garden } = await startedSession()
    await expect(rpc(db, user, 'start_session', { p_garden_id: garden.id })).rejects.toMatchObject({ code: 'SP002' })
    const other = await createGarden(db, user, { name: 'Treino' })
    await expect(rpc(db, user, 'start_session', { p_garden_id: other.id })).rejects.toMatchObject({ code: 'SP002' })
  })

  it('sem heartbeat no meio do foco a sessão continua ativa (dá pra voltar e concluir)', async () => {
    const { user, garden, s } = await startedSession()
    await ageSession(db, s.id, 5, 100)
    await expect(rpc(db, user, 'start_session', { p_garden_id: garden.id })).rejects.toMatchObject({ code: 'SP002' })
    expect(await session(s.id)).toMatchObject({ status: 'active' })
    expect((await plant(s.plant_id)).status).toBe('growing')
  })

  it('sessão esquecida (sem heartbeat e passou do planejado + 2 h) é abandonada e a planta morre', async () => {
    const { user, garden, s } = await startedSession()
    await ageSession(db, s.id, 25 + 121, 100)
    const next = await rpc<Session>(db, user, 'start_session', { p_garden_id: garden.id })
    expect(await session(s.id)).toMatchObject({ status: 'abandoned', fail_reason: 'no_heartbeat' })
    expect((await plant(s.plant_id)).status).toBe('dead')
    expect(next.status).toBe('active')
  })

  it('expire_stale_sessions deixa o jardim mostrar a planta morta sem precisar começar outra sessão', async () => {
    const { user, s } = await startedSession()
    await ageSession(db, s.id, 25 + 121, 95)
    expect(await rpc<number>(db, user, 'expire_stale_sessions')).toBe(1)
    expect((await plant(s.plant_id)).status).toBe('dead')
  })

  it('heartbeat responde true enquanto a sessão vale e false depois que acaba', async () => {
    const { user, s } = await startedSession()
    expect(await rpc<boolean>(db, user, 'session_heartbeat', { p_session_id: s.id })).toBe(true)
    await rpc(db, user, 'fail_session', { p_session_id: s.id, p_reason: 'gave_up' })
    expect(await rpc<boolean>(db, user, 'session_heartbeat', { p_session_id: s.id })).toBe(false)
  })

  it('não dá pra concluir a mesma sessão duas vezes', async () => {
    const { user, s } = await startedSession()
    await ageSession(db, s.id, 25)
    await rpc(db, user, 'finish_session', { p_session_id: s.id, p_exits: 0 })
    await expect(rpc(db, user, 'finish_session', { p_session_id: s.id, p_exits: 0 })).rejects.toMatchObject({
      code: 'SP003',
    })
  })

  it('jardim arquivado não aceita sessão nova', async () => {
    const user = await createUser(db)
    const garden = await createGarden(db, user, { archived_at: new Date().toISOString() })
    await expect(rpc(db, user, 'start_session', { p_garden_id: garden.id })).rejects.toMatchObject({ code: 'SP001' })
  })
})

describe('Árvores', () => {
  it('a semente nova é sempre uma das três árvores', async () => {
    const { s } = await startedSession()
    const { rows } = await db.query<{ species: string }>('select species from plants where id = $1', [s.plant_id])
    expect(['pinheiro', 'macieira', 'cerejeira']).toContain(rows[0].species)
  })

  it('o banco recusa espécie fora da lista (como as flores antigas)', async () => {
    const { s } = await startedSession()
    await expect(db.query(`update plants set species = 'rosa' where id = $1`, [s.plant_id])).rejects.toThrow(/species_values/)
  })
})
