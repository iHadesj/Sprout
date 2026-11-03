import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { as, createDb, createGarden, createUser, rpc } from './db.ts'

let db: PGlite
beforeAll(async () => {
  db = await createDb()
}, 60_000)

/** Usuário com um jardim e uma sessão ativa (portanto com uma planta). */
async function userWithPlant() {
  const user = await createUser(db)
  const garden = await createGarden(db, user)
  const s = await rpc<{ id: string; plant_id: string }>(db, user, 'start_session', { p_garden_id: garden.id })
  return { user, garden, session: s }
}

describe('Fase 2 · update direto em plants é bloqueado', () => {
  it('update em plants dá permission denied', async () => {
    const { user, session } = await userWithPlant()
    await expect(
      as(db, user, (tx) => tx.query('update plants set growth = 10 where id = $1', [session.plant_id])),
    ).rejects.toMatchObject({ code: '42501' })
    const { rows } = await db.query<{ growth: number }>('select growth from plants where id = $1', [session.plant_id])
    expect(rows[0].growth).toBe(0)
  })

  it('insert e delete em plants também', async () => {
    const { user, garden, session } = await userWithPlant()
    await expect(
      as(db, user, (tx) =>
        tx.query(
          `insert into plants (garden_id, user_id, species, growth, status, position_x, position_z)
           values ($1, $2, 'pinheiro', 10, 'grown', 0, 0)`,
          [garden.id, user],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      as(db, user, (tx) => tx.query('delete from plants where id = $1', [session.plant_id])),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('sessions também só muda pelas funções', async () => {
    const { user, garden, session } = await userWithPlant()
    await expect(
      as(db, user, (tx) => tx.query(`update sessions set status = 'completed' where id = $1`, [session.id])),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      as(db, user, (tx) =>
        tx.query(
          `insert into sessions (user_id, garden_id, plant_id, planned_minutes, status)
           values ($1, $2, $3, 25, 'completed')`,
          [user, garden.id, session.plant_id],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('cada um só vê e mexe no que é seu', () => {
  it('um usuário não lê plantas, sessões nem jardins de outro', async () => {
    const a = await userWithPlant()
    const b = await createUser(db)
    const counts = await as(db, b, async (tx) => {
      const q = async (table: string) =>
        (await tx.query<{ n: number }>(`select count(*)::int as n from ${table} where user_id = $1`, [a.user])).rows[0].n
      return { plants: await q('plants'), sessions: await q('sessions'), gardens: await q('gardens') }
    })
    expect(counts).toEqual({ plants: 0, sessions: 0, gardens: 0 })
  })

  it('um usuário não começa, termina nem falha sessão no jardim de outro', async () => {
    const a = await userWithPlant()
    const b = await createUser(db)
    await expect(rpc(db, b, 'start_session', { p_garden_id: a.garden.id })).rejects.toMatchObject({ code: 'SP001' })
    await expect(rpc(db, b, 'finish_session', { p_session_id: a.session.id, p_exits: 0 })).rejects.toMatchObject({
      code: 'SP003',
    })
    await rpc(db, b, 'fail_session', { p_session_id: a.session.id, p_reason: 'gave_up' })
    const { rows } = await db.query<{ status: string }>('select status from sessions where id = $1', [a.session.id])
    expect(rows[0].status).toBe('active')
  })

  it('um usuário não edita o jardim de outro', async () => {
    const a = await userWithPlant()
    const b = await createUser(db)
    const updated = await as(db, b, (tx) =>
      tx.query(`update gardens set name = 'hackeado' where id = $1 returning id`, [a.garden.id]),
    )
    expect(updated.rows).toHaveLength(0)
  })

  it('jardim novo é sempre do usuário logado', async () => {
    const a = await createUser(db)
    const b = await createUser(db)
    await expect(createGarden(db, b, { user_id: a })).rejects.toMatchObject({ code: '42501' })
    const own = await createGarden(db, b)
    expect(own).toMatchObject({ name: 'Faculdade' })
  })

  it('jardim não pode ser apagado, só arquivado', async () => {
    const { user, garden } = await userWithPlant()
    await expect(as(db, user, (tx) => tx.query('delete from gardens where id = $1', [garden.id]))).rejects.toMatchObject({
      code: '42501',
    })
    const archived = await as(db, user, (tx) =>
      tx.query('update gardens set archived_at = now() where id = $1 returning id', [garden.id]),
    )
    expect(archived.rows).toHaveLength(1)
  })

  it('tempo de foco fora de 15 a 60 min é recusado', async () => {
    const user = await createUser(db)
    await expect(createGarden(db, user, { focus_minutes: 10 })).rejects.toMatchObject({ code: '23514' })
    await expect(createGarden(db, user, { focus_minutes: 90 })).rejects.toMatchObject({ code: '23514' })
  })
})

describe('visitante sem login', () => {
  it('não executa nenhuma RPC', async () => {
    const { garden } = await userWithPlant()
    await expect(rpc(db, null, 'start_session', { p_garden_id: garden.id })).rejects.toMatchObject({ code: '42501' })
    await expect(rpc(db, null, 'expire_stale_sessions')).rejects.toMatchObject({ code: '42501' })
  })

  it('não lê nenhuma tabela', async () => {
    await expect(as(db, null, (tx) => tx.query('select * from plants'))).rejects.toMatchObject({ code: '42501' })
    await expect(as(db, null, (tx) => tx.query('select * from gardens'))).rejects.toMatchObject({ code: '42501' })
  })
})

describe('perfil', () => {
  it('é criado no cadastro com username e fuso dos metadados', async () => {
    const id = await createUser(db, { username: 'Edu_Foco', timezone: 'America/Manaus' })
    const { rows } = await db.query('select username, timezone from profiles where id = $1', [id])
    expect(rows[0]).toEqual({ username: 'edu_foco', timezone: 'America/Manaus' })
  })

  it('username repetido ou inválido não impede o cadastro', async () => {
    await createUser(db, { username: 'repetido' })
    const id = await createUser(db, { username: 'repetido', timezone: 'Lugar/Nenhum' })
    const { rows } = await db.query('select username, timezone from profiles where id = $1', [id])
    expect(rows[0]).toEqual({ username: null, timezone: 'America/Sao_Paulo' })
  })

  it('fuso inválido é recusado na edição', async () => {
    const id = await createUser(db)
    await expect(
      as(db, id, (tx) => tx.query(`update profiles set timezone = 'Marte/Olympus' where id = $1`, [id])),
    ).rejects.toMatchObject({ code: '22023' })
    const ok = await as(db, id, (tx) =>
      tx.query(`update profiles set timezone = 'Europe/Lisbon' where id = $1 returning timezone`, [id]),
    )
    expect(ok.rows).toHaveLength(1)
  })
})
