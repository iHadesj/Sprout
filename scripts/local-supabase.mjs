// Supabase local "de mentira", só pra desenvolvimento e testes E2E. Não vai pra produção.
//
// O banco é Postgres de verdade (PGlite) com as MESMAS migrations de supabase/migrations,
// então RLS, RPCs e regras são as reais. Na frente fica uma imitação pequena das duas
// APIs que o app usa: Auth (cadastro e login com JWT) e REST (o PostgREST: select,
// insert, update com filtros simples, e RPC). Só o suficiente pro app rodar sem nuvem.
//
// Uso: node scripts/local-supabase.mjs   (ou npm run dev:local, que sobe o app junto)

import { PGlite } from '@electric-sql/pglite'
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const JWT_SECRET = 'sprout-local-nao-use-em-producao'
const ACCESS_TTL_S = 3600
const IDENT = /^[a-z_][a-z0-9_]*$/

/** Sobe o banco + API. `dataDir` guarda o banco em disco; sem ele, fica só na memória. */
export async function startLocalSupabase({ port = 54321, dataDir } = {}) {
  const db = new PGlite(dataDir)
  await db.waitReady
  await migrate(db)
  const server = createServer((req, res) => {
    handle(db, req, res).catch((error) => send(res, 500, { code: 'XX000', message: String(error?.message ?? error) }))
  })
  await new Promise((resolve) => server.listen(port, resolve))
  return {
    db,
    url: `http://localhost:${port}`,
    close: async () => {
      await new Promise((resolve) => server.close(resolve))
      await db.close()
    },
  }
}

// ---------- banco ----------

async function migrate(db) {
  await db.exec(`create schema if not exists local_meta;
    create table if not exists local_meta.applied (name text primary key, at timestamptz default now());
    create table if not exists local_meta.refresh_tokens (token text primary key, user_id uuid not null);`)
  const applied = new Set((await db.query('select name from local_meta.applied')).rows.map((r) => r.name))
  const files = [
    ['supabase-stub.sql', join(ROOT, 'supabase', 'tests', 'supabase-stub.sql')],
    ...readdirSync(join(ROOT, 'supabase', 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => [f, join(ROOT, 'supabase', 'migrations', f)]),
  ]
  for (const [name, path] of files) {
    if (applied.has(name)) continue
    await db.exec(readFileSync(path, 'utf8'))
    await db.query('insert into local_meta.applied (name) values ($1)', [name])
  }
}

/** Roda `fn` com o papel e o JWT da requisição, como o PostgREST faz. */
function asRequester(db, claims, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${claims.role === 'authenticated' ? 'authenticated' : 'anon'}`)
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
    return fn(tx)
  })
}

// ---------- HTTP ----------

async function handle(db, req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return send(res, 204)
  const url = new URL(req.url, 'http://localhost')
  const body = await readBody(req)

  if (url.pathname.startsWith('/auth/v1/')) return auth(db, req, res, url, body)

  const claims = readClaims(req)
  if (claims === 'expired') return send(res, 401, { code: 'PGRST301', message: 'JWT expired' })

  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_][a-z0-9_]*)$/)
  if (rpc && req.method === 'POST') return callRpc(db, res, claims, rpc[1], body)

  const table = url.pathname.match(/^\/rest\/v1\/([a-z_][a-z0-9_]*)$/)
  if (table) return tableRequest(db, req, res, claims, table[1], url, body)

  send(res, 404, { code: 'PGRST000', message: `rota não suportada: ${req.method} ${url.pathname}` })
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? '*')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, x-supabase-api-version')
  res.setHeader('Access-Control-Max-Age', '600')
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null)
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function send(res, status, data, headers = {}) {
  res.writeHead(status, { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers })
  res.end(data === undefined ? undefined : JSON.stringify(data))
}

// ---------- Auth (imitação do Supabase Auth / GoTrue) ----------

const AUTH_HEADERS = { 'x-supabase-api-version': '2024-01-01' }

function authError(res, status, code, message) {
  send(res, status, { code, error_code: code, msg: message, message }, AUTH_HEADERS)
}

async function auth(db, req, res, url, body) {
  const path = url.pathname.slice('/auth/v1'.length)

  if (path === '/signup' && req.method === 'POST') {
    const { email, password, data = {} } = body ?? {}
    if (!email || !password) return authError(res, 400, 'validation_failed', 'Email e senha são obrigatórios')
    if (String(password).length < 6) {
      return send(res, 422, { code: 'weak_password', msg: 'Password should be at least 6 characters.', weak_password: { reasons: ['length'] } }, AUTH_HEADERS)
    }
    const exists = await db.query('select 1 from auth.users where email = $1', [email.toLowerCase()])
    if (exists.rows.length) return authError(res, 422, 'user_already_exists', 'User already registered')
    const { rows } = await db.query(
      'insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, $2, $3) returning *',
      [email.toLowerCase(), hashPassword(password), JSON.stringify(data)],
    )
    return send(res, 200, await newSession(db, rows[0]), AUTH_HEADERS)
  }

  if (path === '/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type')
    if (grant === 'password') {
      const { rows } = await db.query('select * from auth.users where email = $1', [String(body?.email ?? '').toLowerCase()])
      if (!rows[0] || !checkPassword(String(body?.password ?? ''), rows[0].encrypted_password)) {
        return authError(res, 400, 'invalid_credentials', 'Invalid login credentials')
      }
      return send(res, 200, await newSession(db, rows[0]), AUTH_HEADERS)
    }
    if (grant === 'refresh_token') {
      const { rows } = await db.query(
        `delete from local_meta.refresh_tokens t using auth.users u
          where t.token = $1 and u.id = t.user_id returning u.*`,
        [body?.refresh_token ?? ''],
      )
      if (!rows[0]) return authError(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found')
      return send(res, 200, await newSession(db, rows[0]), AUTH_HEADERS)
    }
    return authError(res, 400, 'unsupported_grant_type', 'grant_type não suportado')
  }

  if (path === '/user' && req.method === 'GET') {
    const claims = readClaims(req)
    if (claims === 'expired' || claims.role !== 'authenticated') return authError(res, 401, 'bad_jwt', 'invalid JWT')
    const { rows } = await db.query('select * from auth.users where id = $1', [claims.sub])
    if (!rows[0]) return authError(res, 404, 'user_not_found', 'User not found')
    return send(res, 200, userJson(rows[0]), AUTH_HEADERS)
  }

  if (path === '/logout' && req.method === 'POST') return send(res, 204)

  authError(res, 404, 'not_found', `rota de auth não suportada: ${path}`)
}

async function newSession(db, user) {
  const now = Math.floor(Date.now() / 1000)
  const refresh = randomBytes(24).toString('base64url')
  await db.query('insert into local_meta.refresh_tokens (token, user_id) values ($1, $2)', [refresh, user.id])
  const access = signJwt({
    aud: 'authenticated',
    exp: now + ACCESS_TTL_S,
    iat: now,
    sub: user.id,
    email: user.email,
    role: 'authenticated',
    aal: 'aal1',
    session_id: randomUUID(),
    is_anonymous: false,
    user_metadata: user.raw_user_meta_data,
    app_metadata: { provider: 'email', providers: ['email'] },
  })
  return {
    access_token: access,
    token_type: 'bearer',
    expires_in: ACCESS_TTL_S,
    expires_at: now + ACCESS_TTL_S,
    refresh_token: refresh,
    user: userJson(user),
  }
}

function userJson(user) {
  const created = new Date(user.created_at).toISOString()
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    email_confirmed_at: created,
    confirmed_at: created,
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: user.raw_user_meta_data ?? {},
    identities: [],
    created_at: created,
    updated_at: created,
    is_anonymous: false,
  }
}

function hashPassword(password) {
  const salt = randomBytes(16)
  return `${salt.toString('hex')}:${scryptSync(password, salt, 32).toString('hex')}`
}

function checkPassword(password, stored) {
  const [salt, hash] = String(stored ?? '').split(':')
  if (!salt || !hash) return false
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, 'hex'), 32), Buffer.from(hash, 'hex'))
}

// ---------- JWT (HS256) ----------

function signJwt(payload) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

/** Claims do JWT da requisição; sem JWT válido, a requisição é de visitante (anon). */
function readClaims(req) {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  const [head, body, sig] = token.split('.')
  if (!head || !body || !sig) return { role: 'anon' }
  const expected = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url')
  if (sig !== expected) return { role: 'anon' }
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (claims.exp && claims.exp < Date.now() / 1000) return 'expired'
  return claims
}

// ---------- REST (imitação do PostgREST) ----------

function pgError(res, claims, error) {
  const code = error?.code ?? 'XX000'
  const status =
    code === '42501' ? (claims.role === 'anon' ? 401 : 403)
    : code === '23505' || code === '23503' ? 409
    : code === '42883' || code === '42P01' ? 404
    : code.startsWith('XX') ? 500
    : 400
  send(res, status, { code, message: error?.message ?? String(error), details: error?.detail ?? null, hint: error?.hint ?? null })
}

async function callRpc(db, res, claims, fn, body) {
  const args = body ?? {}
  const names = Object.keys(args)
  if (!names.every((n) => IDENT.test(n))) return send(res, 400, { code: 'PGRST100', message: 'argumento inválido' })
  const info = await db.query(
    `select p.proretset as setof, t.typtype as kind from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype
      where n.nspname = 'public' and p.proname = $1`,
    [fn],
  )
  if (!info.rows[0]) return send(res, 404, { code: 'PGRST202', message: `função ${fn} não encontrada` })
  const { setof, kind } = info.rows[0]
  const params = names.map((n, i) => `${n} => $${i + 1}`).join(', ')
  const values = names.map((n) => toParam(args[n]))
  try {
    const result = await asRequester(db, claims, (tx) => tx.query(`select * from public.${fn}(${params})`, values))
    // `returns table` é setof record (pseudotipo, como void): checar setof primeiro
    if (setof) return send(res, 200, result.rows.map((row) => plain(row, result.fields)))
    if (kind === 'p') return send(res, 204) // void
    if (kind === 'c') return send(res, 200, result.rows[0] ? plain(result.rows[0], result.fields) : null)
    return send(res, 200, result.rows[0]?.[fn] ?? null)
  } catch (error) {
    pgError(res, claims, error)
  }
}

async function tableRequest(db, req, res, claims, table, url, body) {
  const prefer = String(req.headers.prefer ?? '')
  const wantsObject = String(req.headers.accept ?? '').includes('application/vnd.pgrst.object+json')
  const representation = prefer.includes('return=representation')
  let where
  try {
    where = buildWhere(url.searchParams)
  } catch (error) {
    return send(res, 400, { code: 'PGRST100', message: error.message })
  }
  const columns = selectColumns(url.searchParams.get('select'))
  if (!columns) return send(res, 400, { code: 'PGRST100', message: 'select com recurso não suportado no backend local' })

  let sql
  let values = where.values
  if (req.method === 'GET') {
    sql = `select ${columns} from public.${table}${where.sql}${orderBy(url.searchParams)}${limitOffset(url.searchParams)}`
  } else if (req.method === 'POST') {
    const rows = Array.isArray(body) ? body : [body]
    const cols = Object.keys(rows[0] ?? {})
    if (!cols.every((c) => IDENT.test(c))) return send(res, 400, { code: 'PGRST100', message: 'coluna inválida' })
    values = rows.flatMap((row) => cols.map((c) => toParam(row[c])))
    const tuples = rows.map((_, r) => `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(', ')})`)
    sql = `insert into public.${table} (${cols.join(', ')}) values ${tuples.join(', ')} returning ${columns}`
  } else if (req.method === 'PATCH') {
    const cols = Object.keys(body ?? {})
    if (!cols.length || !cols.every((c) => IDENT.test(c))) return send(res, 400, { code: 'PGRST100', message: 'nada pra atualizar' })
    const offset = where.values.length
    const sets = cols.map((c, i) => `${c} = $${offset + i + 1}`).join(', ')
    values = [...where.values, ...cols.map((c) => toParam(body[c]))]
    sql = `update public.${table} set ${sets}${where.sql} returning ${columns}`
  } else if (req.method === 'DELETE') {
    sql = `delete from public.${table}${where.sql} returning ${columns}`
  } else {
    return send(res, 405, { code: 'PGRST000', message: 'método não suportado' })
  }

  try {
    const result = await asRequester(db, claims, (tx) => tx.query(sql, values))
    const rows = result.rows.map((row) => plain(row, result.fields))
    if (req.method !== 'GET' && !representation) return send(res, req.method === 'POST' ? 201 : 204)
    if (wantsObject) {
      if (rows.length !== 1) {
        return send(res, 406, {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
          details: `The result contains ${rows.length} rows`,
          hint: null,
        })
      }
      return send(res, req.method === 'POST' ? 201 : 200, rows[0])
    }
    return send(res, req.method === 'POST' ? 201 : 200, rows, { 'Content-Range': `0-${Math.max(rows.length - 1, 0)}/*` })
  } catch (error) {
    pgError(res, claims, error)
  }
}

function selectColumns(select) {
  if (!select || select === '*') return '*'
  const cols = select.split(',').map((c) => c.trim())
  return cols.every((c) => IDENT.test(c)) ? cols.join(', ') : null
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'])
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }

/** Filtros do PostgREST (?coluna=operador.valor) viram um WHERE com parâmetros. */
function buildWhere(params) {
  const parts = []
  const values = []
  for (const [col, raw] of params) {
    if (RESERVED.has(col)) continue
    if (!IDENT.test(col)) throw new Error(`coluna inválida: ${col}`)
    const dot = raw.indexOf('.')
    const op = raw.slice(0, dot)
    const value = raw.slice(dot + 1)
    if (op in OPS) {
      values.push(op.endsWith('like') ? value.replaceAll('*', '%') : value)
      parts.push(`${col} ${OPS[op]} $${values.length}`)
    } else if (op === 'is' && ['null', 'true', 'false'].includes(value)) {
      parts.push(`${col} is ${value}`)
    } else if (op === 'in' && value.startsWith('(') && value.endsWith(')')) {
      const items = value.slice(1, -1).split(',').map((v) => v.trim().replace(/^"(.*)"$/, '$1'))
      const marks = items.map((item) => {
        values.push(item)
        return `$${values.length}`
      })
      parts.push(items.length ? `${col} in (${marks.join(', ')})` : 'false')
    } else {
      throw new Error(`filtro não suportado no backend local: ${col}=${raw}`)
    }
  }
  return { sql: parts.length ? ` where ${parts.join(' and ')}` : '', values }
}

function orderBy(params) {
  const order = params.get('order')
  if (!order) return ''
  const terms = order.split(',').map((term) => {
    const [col, ...mods] = term.split('.')
    if (!IDENT.test(col)) throw new Error(`coluna inválida em order: ${col}`)
    const dir = mods.includes('desc') ? ' desc' : ' asc'
    const nulls = mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : ''
    return `${col}${dir}${nulls}`
  })
  return ` order by ${terms.join(', ')}`
}

function limitOffset(params) {
  const limit = Number(params.get('limit'))
  const offset = Number(params.get('offset'))
  return `${Number.isInteger(limit) && limit > 0 ? ` limit ${limit}` : ''}${Number.isInteger(offset) && offset > 0 ? ` offset ${offset}` : ''}`
}

function toParam(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

const DATE_OID = 1082

/** Linha do PGlite -> JSON igual ao do PostgREST (timestamps em ISO, date como AAAA-MM-DD). */
function plain(row, fields = []) {
  const dates = new Set(fields.filter((f) => f.dataTypeID === DATE_OID).map((f) => f.name))
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) out[key] = dates.has(key) ? value.toISOString().slice(0, 10) : value.toISOString()
    else out[key] = typeof value === 'bigint' ? Number(value) : value
  }
  return out
}

// ---------- linha de comando ----------

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 54321)
  const dataDir = process.argv.includes('--memory') ? undefined : join(ROOT, '.local-db')
  const api = await startLocalSupabase({ port, dataDir })
  console.log(`Supabase local em ${api.url} (banco ${dataDir ? 'em .local-db/' : 'na memória'})`)
}
