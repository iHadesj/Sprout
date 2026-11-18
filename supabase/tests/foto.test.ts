import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { as, createDb, createUser } from './db.ts'

let db: PGlite
beforeAll(async () => {
  db = await createDb()
}, 60_000)

const upload = (user: string, name: string) =>
  as(db, user, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [name]))

describe('foto de perfil · arquivos', () => {
  it('o bucket existe, é público e só aceita imagem pequena', async () => {
    const { rows } = await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'`,
    )
    expect(rows[0].public).toBe(true)
    expect(Number(rows[0].file_size_limit)).toBeLessThanOrEqual(300_000)
    expect(rows[0].allowed_mime_types).toContain('image/webp')
  })

  it('cada um envia só na pasta com o próprio id', async () => {
    const me = await createUser(db)
    const other = await createUser(db)
    await upload(me, `${me}/abcdefgh.webp`)
    await expect(upload(me, `${other}/abcdefgh.webp`)).rejects.toMatchObject({ code: '42501' })
    await expect(upload(me, 'solto.webp')).rejects.toMatchObject({ code: '42501' })
  })

  it('ninguém apaga a foto de outra pessoa', async () => {
    const me = await createUser(db)
    const other = await createUser(db)
    await upload(other, `${other}/ijklmnop.webp`)
    const { affectedRows } = await as(db, me, (tx) => tx.query(`delete from storage.objects where name = $1`, [`${other}/ijklmnop.webp`]))
    expect(affectedRows).toBe(0)
    const own = await as(db, other, (tx) => tx.query(`delete from storage.objects where name = $1`, [`${other}/ijklmnop.webp`]))
    expect(own.affectedRows).toBe(1)
  })

  it('visitante não envia nada', async () => {
    const me = await createUser(db)
    await expect(
      as(db, null, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${me}/qrstuvwx.webp`])),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('foto de perfil · perfil', () => {
  it('o dono escolhe uma foto da própria pasta', async () => {
    const me = await createUser(db)
    await as(db, me, (tx) => tx.query(`update profiles set avatar_path = $1 where id = $2`, [`${me}/0f3a9c1e-77aa.webp`, me]))
    const { rows } = await db.query<{ avatar_path: string }>('select avatar_path from profiles where id = $1', [me])
    expect(rows[0].avatar_path).toBe(`${me}/0f3a9c1e-77aa.webp`)
  })

  it('não dá pra apontar pra foto de outra pessoa nem pra um link qualquer', async () => {
    const me = await createUser(db)
    const other = await createUser(db)
    for (const path of [`${other}/0f3a9c1e-77aa.webp`, 'https://exemplo.com/x.png', `${me}/../${other}/a.webp`, `${me}/0f3a9c1e.gif`]) {
      await expect(
        as(db, me, (tx) => tx.query(`update profiles set avatar_path = $1 where id = $2`, [path, me])),
      ).rejects.toMatchObject({ code: '23514' })
    }
  })

  it('amigos e ranking devolvem a foto', async () => {
    const me = await createUser(db, { username: 'eu_foto' })
    const friend = await createUser(db, { username: 'amiga_foto' })
    await db.query(`update profiles set avatar_path = $1 where id = $2`, [`${friend}/0f3a9c1e-77aa.webp`, friend])
    await db.query(`insert into friendships (requester_id, addressee_id, status, accepted_at) values ($1, $2, 'accepted', now())`, [me, friend])
    const friends = await as(db, me, (tx) => tx.query<{ user_id: string; avatar_path: string | null }>('select * from list_friends()'))
    expect(friends.rows.find((r) => r.user_id === friend)?.avatar_path).toBe(`${friend}/0f3a9c1e-77aa.webp`)
    const ranking = await as(db, me, (tx) => tx.query<{ user_id: string; avatar_path: string | null }>('select * from friend_ranking()'))
    expect(ranking.rows.find((r) => r.user_id === friend)?.avatar_path).toBe(`${friend}/0f3a9c1e-77aa.webp`)
    expect(ranking.rows.find((r) => r.user_id === me)?.avatar_path).toBeNull()
  })
})
