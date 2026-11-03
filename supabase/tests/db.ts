// Banco de teste: Postgres de verdade rodando em WASM (PGlite), com as migrations aplicadas.
// `as(userId)` executa SQL como o usuário logado, do jeito que o Supabase faz:
// troca pro papel `authenticated` e põe o id no JWT da requisição.
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')

export function migrationFiles(): string[] {
  const dir = join(ROOT, 'migrations')
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(dir, f))
}

export async function createDb(): Promise<PGlite> {
  const db = await PGlite.create()
  await db.exec(readFileSync(join(ROOT, 'tests', 'supabase-stub.sql'), 'utf8'))
  for (const file of migrationFiles()) await db.exec(readFileSync(file, 'utf8'))
  return db
}

/** Cria um usuário como o Supabase Auth faria (dispara o trigger que cria o profile). */
export async function createUser(db: PGlite, meta: Record<string, string> = {}): Promise<string> {
  const email = `${crypto.randomUUID()}@teste.dev`
  const { rows } = await db.query<{ id: string }>(
    'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
    [email, JSON.stringify(meta)],
  )
  return rows[0].id
}

/** Roda `fn` como o usuário `userId` (ou como visitante anônimo, se null). */
export async function as<T>(db: PGlite, userId: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}`)
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(userId ? { sub: userId, role: 'authenticated' } : { role: 'anon' }),
    ])
    return fn(tx)
  })
}

/** Chama uma RPC como o usuário, igual a supabase.rpc(nome, args). */
export async function rpc<T = Record<string, unknown>>(
  db: PGlite,
  userId: string | null,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const params = Object.keys(args)
    .map((name, i) => `${name} => $${i + 1}`)
    .join(', ')
  return as(db, userId, async (tx) => {
    const { rows, fields } = await tx.query<Record<string, unknown>>(`select * from ${fn}(${params})`, Object.values(args))
    // função que retorna linha (sessions) vem com várias colunas; escalar/void vem numa coluna com o nome dela
    if (fields.length === 1 && fields[0].name === fn) return rows[0][fn] as T
    return rows[0] as T
  })
}

/**
 * "Viaja no tempo": como a duração é medida pelo banco, os testes empurram o início
 * da sessão pra trás em vez de esperar 25 minutos de verdade. Roda como dono do banco.
 */
export async function ageSession(db: PGlite, sessionId: string, minutes: number, heartbeatAgoSeconds = 0) {
  await db.query(
    `update sessions
        set started_at = started_at - make_interval(secs => $2),
            last_heartbeat_at = now() - make_interval(secs => $3)
      where id = $1`,
    [sessionId, minutes * 60, heartbeatAgoSeconds],
  )
}

export async function createGarden(db: PGlite, userId: string, fields: Record<string, unknown> = {}) {
  const data = { name: 'Faculdade', ...fields }
  const cols = Object.keys(data)
  return as(db, userId, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `insert into gardens (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
      Object.values(data),
    )
    return rows[0]
  })
}
