import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { as, createDb, createGarden, createUser, rpc } from './db.ts'

let db: PGlite
beforeAll(async () => {
  db = await createDb()
}, 60_000)

let counter = 0
/** Usuário com nome único (o nome é como se acha alguém pra pedir amizade). */
async function person() {
  counter += 1
  const username = `pessoa_${counter}_${Math.floor(Math.random() * 1e6)}`
  const id = await createUser(db, { username })
  return { id, username }
}

/** Todas as linhas de uma função que devolve tabela, chamada como o usuário. */
async function rows<T>(user: string, sql: string, params: unknown[] = []): Promise<T[]> {
  return as(db, user, async (tx) => (await tx.query<T>(sql, params)).rows)
}

async function befriend(a: { id: string; username: string }, b: { id: string }) {
  await rpc(db, b.id, 'send_friend_request', { p_username: a.username })
  await rpc(db, a.id, 'respond_friend_request', { p_user: b.id, p_accept: true })
}

/** Sessões concluídas direto no banco (como dono): o tempo delas não importa pra estes testes. */
async function completedSessions(user: string, count: number, minutes = 25) {
  const garden = await createGarden(db, user)
  const s = await rpc<{ id: string; plant_id: string }>(db, user, 'start_session', { p_garden_id: garden.id })
  await db.query(`update sessions set status = 'invalid', ended_at = now() where id = $1`, [s.id])
  for (let i = 0; i < count; i++) {
    await db.query(
      `insert into sessions (user_id, garden_id, plant_id, planned_minutes, started_at, last_heartbeat_at, ended_at, status)
       values ($1, $2, $3, $4, now() - make_interval(mins => $4), now(), now() - make_interval(secs => $5), 'completed')`,
      [user, garden.id, s.plant_id, minutes, count - i],
    )
  }
  return garden
}

describe('amizade', () => {
  it('pedido pelo nome fica pendente até o outro aceitar', async () => {
    const [a, b] = [await person(), await person()]
    expect(await rpc(db, a.id, 'send_friend_request', { p_username: b.username })).toBe('requested')
    const fromB = await rows<{ username: string; direction: string }>(b.id, 'select * from list_friends()')
    expect(fromB).toEqual([expect.objectContaining({ username: a.username, direction: 'incoming' })])

    await rpc(db, b.id, 'respond_friend_request', { p_user: a.id, p_accept: true })
    const fromA = await rows<{ direction: string }>(a.id, 'select * from list_friends()')
    expect(fromA[0].direction).toBe('friend')
  })

  it('se os dois pedem, vira amizade na hora', async () => {
    const [a, b] = [await person(), await person()]
    await rpc(db, a.id, 'send_friend_request', { p_username: b.username })
    expect(await rpc(db, b.id, 'send_friend_request', { p_username: a.username })).toBe('accepted')
  })

  it('pedido recusado some e não vira amizade', async () => {
    const [a, b] = [await person(), await person()]
    await rpc(db, a.id, 'send_friend_request', { p_username: b.username })
    await rpc(db, b.id, 'respond_friend_request', { p_user: a.id, p_accept: false })
    expect(await rows(a.id, 'select * from list_friends()')).toEqual([])
  })

  it('quem mandou o pedido não pode aceitar sozinho', async () => {
    const [a, b] = [await person(), await person()]
    await rpc(db, a.id, 'send_friend_request', { p_username: b.username })
    await expect(rpc(db, a.id, 'respond_friend_request', { p_user: b.id, p_accept: true })).rejects.toMatchObject({ code: 'SP006' })
  })

  it('nome que não existe e pedir pra si mesmo dão erro', async () => {
    const a = await person()
    await expect(rpc(db, a.id, 'send_friend_request', { p_username: 'ninguem_mesmo' })).rejects.toMatchObject({ code: 'SP006' })
    await expect(rpc(db, a.id, 'send_friend_request', { p_username: a.username })).rejects.toMatchObject({ code: 'SP005' })
  })

  it('link de convite vira amizade direto', async () => {
    const [a, b] = [await person(), await person()]
    const { rows: me } = await db.query<{ invite_code: string }>('select invite_code from profiles where id = $1', [a.id])
    expect(await rpc(db, b.id, 'invite_info', { p_code: me[0].invite_code })).toBe(a.username)
    expect(await rpc(db, b.id, 'join_by_invite', { p_code: me[0].invite_code })).toBe(a.username)
    const list = await rows<{ username: string; direction: string }>(a.id, 'select * from list_friends()')
    expect(list).toEqual([expect.objectContaining({ username: b.username, direction: 'friend' })])
    await expect(rpc(db, a.id, 'join_by_invite', { p_code: me[0].invite_code })).rejects.toMatchObject({ code: 'SP005' })
  })

  it('ninguém escreve direto nas tabelas', async () => {
    const [a, b] = [await person(), await person()]
    await expect(
      as(db, a.id, (tx) => tx.query(`insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [a.id, b.id])),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      as(db, a.id, (tx) => tx.query(`insert into gifts (from_id, to_id, kind, amount) values ($1, $2, 'heart', 5)`, [a.id, b.id])),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('visitante sem login não chama nada', async () => {
    await expect(rpc(db, null, 'list_friends')).rejects.toMatchObject({ code: '42501' })
  })
})

describe('jardim do amigo', () => {
  it('amigo vê os jardins e as plantas; quem não é amigo não', async () => {
    const [a, b, c] = [await person(), await person(), await person()]
    await befriend(a, b)
    const garden = await createGarden(db, a.id, { name: 'Leitura' })
    await rpc(db, a.id, 'start_session', { p_garden_id: garden.id })

    const gardens = await rows<{ name: string }>(b.id, 'select * from friend_gardens($1)', [a.id])
    expect(gardens.map((g) => g.name)).toEqual(['Leitura'])
    expect(await rows(b.id, 'select * from friend_plants($1)', [a.id])).toHaveLength(1)

    await expect(rows(c.id, 'select * from friend_gardens($1)', [a.id])).rejects.toMatchObject({ code: 'SP007' })
    await expect(rows(c.id, 'select * from friend_plants($1)', [a.id])).rejects.toMatchObject({ code: 'SP007' })
  })

  it('amigo continua sem ler as sessões do outro direto', async () => {
    const [a, b] = [await person(), await person()]
    await befriend(a, b)
    await completedSessions(a.id, 2)
    expect(await rows(b.id, 'select * from sessions where user_id = $1', [a.id])).toEqual([])
  })
})

describe('ranking da semana', () => {
  it('você e seus amigos, por minutos; quem não é amigo fica de fora', async () => {
    const [a, b, c] = [await person(), await person(), await person()]
    await befriend(a, b)
    await completedSessions(a.id, 2, 25)
    await completedSessions(b.id, 1, 50)
    await completedSessions(c.id, 5, 25)
    const ranking = await rows<{ username: string; minutes: number; is_me: boolean }>(a.id, 'select * from friend_ranking()')
    expect(ranking.map((r) => [r.username, r.minutes, r.is_me])).toEqual([
      [a.username, 50, true],
      [b.username, 50, false],
    ])
  })

  it('só as 10 primeiras sessões do dia contam', async () => {
    const a = await person()
    await completedSessions(a.id, 12, 25)
    const [me] = await rows<{ minutes: number; sessions: number }>(a.id, 'select * from friend_ranking()')
    expect(me).toMatchObject({ minutes: 250, sessions: 10 })
  })

  it('pedido pendente não entra no ranking', async () => {
    const [a, b] = [await person(), await person()]
    await rpc(db, a.id, 'send_friend_request', { p_username: b.username })
    expect(await rows(a.id, 'select * from friend_ranking()')).toHaveLength(1)
  })
})

describe('presentes', () => {
  it('corações de 1 a 999, somados por quem mandou', async () => {
    const [a, b] = [await person(), await person()]
    await befriend(a, b)
    await rpc(db, a.id, 'send_gift', { p_to: b.id, p_kind: 'heart', p_amount: 999 })
    await rpc(db, a.id, 'send_gift', { p_to: b.id, p_kind: 'heart', p_amount: 3 })
    const unseen = await rows<{ from_username: string; kind: string; amount: number }>(b.id, 'select * from unseen_gifts()')
    expect(unseen).toEqual([expect.objectContaining({ from_username: a.username, kind: 'heart', amount: 1002 })])
    await expect(rpc(db, a.id, 'send_gift', { p_to: b.id, p_kind: 'heart', p_amount: 1000 })).rejects.toMatchObject({ code: 'SP005' })
  })

  it('regar: uma vez por amigo por dia', async () => {
    const [a, b] = [await person(), await person()]
    await befriend(a, b)
    await rpc(db, a.id, 'send_gift', { p_to: b.id, p_kind: 'water' })
    await expect(rpc(db, a.id, 'send_gift', { p_to: b.id, p_kind: 'water' })).rejects.toMatchObject({ code: 'SP008' })
  })

  it('quem não é amigo não manda presente', async () => {
    const [a, b] = [await person(), await person()]
    await expect(rpc(db, a.id, 'send_gift', { p_to: b.id, p_kind: 'heart', p_amount: 5 })).rejects.toMatchObject({ code: 'SP007' })
  })

  it('depois de vistos, somem da lista', async () => {
    const [a, b] = [await person(), await person()]
    await befriend(a, b)
    await rpc(db, a.id, 'send_gift', { p_to: b.id, p_kind: 'water' })
    expect(await rpc(db, b.id, 'mark_gifts_seen')).toBe(1)
    expect(await rows(b.id, 'select * from unseen_gifts()')).toEqual([])
  })

  it('presente não mexe em planta nenhuma', async () => {
    const [a, b] = [await person(), await person()]
    await befriend(a, b)
    const garden = await createGarden(db, b.id)
    const s = await rpc<{ plant_id: string }>(db, b.id, 'start_session', { p_garden_id: garden.id })
    await rpc(db, a.id, 'send_gift', { p_to: b.id, p_kind: 'water' })
    await rpc(db, a.id, 'send_gift', { p_to: b.id, p_kind: 'heart', p_amount: 999 })
    const { rows: p } = await db.query<{ growth: number; status: string }>('select growth, status from plants where id = $1', [s.plant_id])
    expect(p[0]).toEqual({ growth: 0, status: 'growing' })
  })
})

describe('nome de usuário com ponto', () => {
  async function usernameOf(id: string) {
    const { rows } = await db.query<{ username: string | null }>('select username from profiles where id = $1', [id])
    return rows[0].username
  }

  it('edu.dev vale, e dá pra achar a pessoa por ele', async () => {
    const name = `edu.dev${Math.floor(Math.random() * 1e5)}`
    const id = await createUser(db, { username: name })
    expect(await usernameOf(id)).toBe(name)
    const other = await person()
    expect(await rpc(db, other.id, 'send_friend_request', { p_username: name })).toBe('requested')
  })

  it('ponto no começo, no fim ou dois seguidos não vale (a conta nasce sem nome)', async () => {
    for (const bad of ['.edu', 'edu.', 'edu..dev']) {
      expect(await usernameOf(await createUser(db, { username: bad }))).toBeNull()
    }
  })

  it('a ficha também barra nome inválido', async () => {
    const a = await person()
    await expect(as(db, a.id, (tx) => tx.query(`update profiles set username = 'edu..dev' where id = $1`, [a.id]))).rejects.toMatchObject({ code: '23514' })
  })
})
