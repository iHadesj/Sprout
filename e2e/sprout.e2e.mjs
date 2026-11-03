// Teste ponta a ponta: o app de verdade no Chrome + o Supabase local (mesmas migrations).
// Confere os critérios "pronto quando" do roadmap. Uso: npm run e2e
// Precisa do Google Chrome instalado (ou da variável CHROME_PATH apontando pra ele).
// Capturas de tela ficam em e2e/output/.

import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { createServer } from 'vite'
import { startLocalSupabase } from '../scripts/local-supabase.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'e2e', 'output')
const API_PORT = 54329
const APP_PORT = 5179
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

mkdirSync(OUT, { recursive: true })
const api = await startLocalSupabase({ port: API_PORT })
// variáveis já definidas têm prioridade sobre o .env.localdb
process.env.VITE_SUPABASE_URL = api.url
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_local'
const vite = await createServer({ root: ROOT, mode: 'localdb', logLevel: 'warn', server: { port: APP_PORT, strictPort: true } })
await vite.listen()
const APP = `http://localhost:${APP_PORT}`

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  // GPU de verdade: sem isso o WebGL cai no SwiftShader e fica lentíssimo
  args: ['--no-first-run', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'],
})

let failures = 0
const pageErrors = []
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ok  ' : '  FALHOU'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}
function section(title) {
  console.log(`\n${title}`)
}

// ---------- utilitários ----------

const sql = async (query, params = []) => (await api.db.query(query, params)).rows

async function newPage() {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('dialog', (dialog) => dialog.accept()) // beforeunload: aceita sair
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource|ERR_|status of 40\d/.test(msg.text())) pageErrors.push(msg.text())
  })
  return page
}

/** Clica no botão ou link cujo texto (primeira linha) é exatamente `label`. */
async function click(page, label, scope = 'body') {
  await page.waitForFunction(
    (label, scope) =>
      [...document.querySelector(scope).querySelectorAll('button, a')].some(
        (el) => el.innerText.split('\n')[0].trim() === label && !el.disabled,
      ),
    { timeout: 10_000 },
    label,
    scope,
  )
  await page.evaluate(
    (label, scope) =>
      [...document.querySelector(scope).querySelectorAll('button, a')]
        .find((el) => el.innerText.split('\n')[0].trim() === label && !el.disabled)
        .click(),
    label,
    scope,
  )
}

const text = (page) => page.evaluate(() => document.body.innerText)
const waitText = (page, value, timeout = 10_000) =>
  page.waitForFunction((value) => document.body.innerText.includes(value), { timeout }, value)

/** "Envelhece" a sessão na página: o timer acha que começou `ms` antes (os dois relógios juntos). */
async function advancePageClock(page, ms) {
  await page.evaluate((ms) => {
    window.__sproutFocus.setState((s) => ({
      timer: {
        ...s.timer,
        phaseStartedAt: s.timer.phaseStartedAt - ms,
        wallStartedAt: s.timer.wallStartedAt - ms,
        nextFocusAt: s.timer.nextFocusAt - ms,
      },
    }))
  }, ms)
}

/** Faz o banco achar que a sessão começou `minutes` minutos atrás (o tempo é medido lá). */
async function ageActiveSession(userId, minutes) {
  await sql(
    `update sessions set started_at = started_at - make_interval(mins => $2), last_heartbeat_at = now()
      where user_id = $1 and status = 'active'`,
    [userId, minutes],
  )
}

async function activeSession(userId) {
  return (await sql(`select * from sessions where user_id = $1 and status = 'active'`, [userId]))[0]
}

async function startFocus(page) {
  await click(page, 'Começar foco')
  await page.waitForSelector('[role=timer]', { timeout: 10_000 })
}

/** Completa um foco "honesto": banco e página avançam o tempo do foco inteiro. */
async function completeFocus(page, userId, minutes, rating = 'Sim, focado') {
  await ageActiveSession(userId, minutes)
  await advancePageClock(page, minutes * 60_000)
  await waitText(page, 'Você focou de verdade?').catch(async (error) => {
    await page.screenshot({ path: join(OUT, 'falha-revisao.png') }) // pra ver o que travou
    throw error
  })
  await page.waitForFunction(() => !document.querySelector('[aria-label="Como foi o foco"] button')?.disabled, { timeout: 10_000 })
  await click(page, rating)
  if (rating !== 'Sim, focado') await click(page, 'Enviar resposta')
  await page.waitForSelector('[data-testid=rating-result]', { timeout: 10_000 })
}

async function createGarden(page, name, color) {
  await click(page, (await text(page)).includes('Criar jardim') ? 'Criar jardim' : 'Novo jardim')
  await page.waitForSelector('dialog[open] input:not([type])')
  await page.type('dialog[open] input:not([type])', name)
  if (color) await page.click(`dialog[open] input[value="${color}"]`)
  await page.click('dialog[open] button[type=submit]')
  await page.waitForFunction(() => /\/jardim\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 10_000 })
  return page.evaluate(() => location.pathname.split('/').pop())
}

/** Chamada crua à API, com o token do usuário logado na página (como um "hacker" no console). */
async function rawApi(page, method, path, body) {
  return page.evaluate(
    async (apiUrl, method, path, body) => {
      const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))
      const token = key ? JSON.parse(localStorage.getItem(key)).access_token : null
      const res = await fetch(apiUrl + path, {
        method,
        headers: {
          apikey: 'sb_publishable_local',
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return { status: res.status, body: await res.text() }
    },
    api.url,
    method,
    path,
    body,
  )
}

/** O que está na cena 3D aberta: a planta da vez e os grupos instanciados (adultas/secas). */
async function sceneState(page) {
  return page.evaluate(() => {
    const scene = window.__sprout3d?.scene
    if (!scene) return null
    const growing = scene.getObjectByName('plant-growing')
    const instanced = []
    let burst = false
    scene.traverse((o) => {
      if (o.name?.startsWith('plants:')) instanced.push({ name: o.name, ids: o.userData.ids })
      if (o.name === 'petal-burst') burst = true
    })
    const yellow = scene.getObjectByName('grass-tufts')?.material?.userData?.uniforms?.uYellow?.value ?? 0
    const sign = scene.getObjectByName('honesty-sign')?.userData?.level ?? 0
    return { growing: growing ? { ...growing.userData } : null, instanced, burst, yellow, sign }
  })
}

/** Espera a cena chegar num estado (os dados chegam do servidor e a cena se atualiza). */
async function waitScene(page, predicate, timeout = 10_000) {
  let state = null
  for (const end = Date.now() + timeout; Date.now() < end; await sleep(200)) {
    state = await sceneState(page)
    if (state && predicate(state)) return state
  }
  return state
}

// ---------- roteiro ----------

try {
  const page = await newPage()
  const other = await newPage() // aba pra "sair" pra ela
  await page.bringToFront()

  section('Cadastro e jardins')
  await page.goto(`${APP}/entrar`, { waitUntil: 'networkidle0' })
  await click(page, 'não tem conta? cria uma')
  await page.waitForSelector('input[autocomplete=username]') // o form de cadastro já trocou o de login
  check('o link do login abre o cadastro em /criar-conta', new URL(page.url()).pathname === '/criar-conta')
  await page.type('input[type=email]', 'edu@sprout.test')
  await page.type('input[type=password]', 'senha-forte-123')
  await page.type('input[autocomplete=username]', 'edu')
  await page.click('form button[type=submit]')
  await waitText(page, 'Comece pelo primeiro jardim')
  const [{ id: userId }] = await sql(`select id from auth.users where email = 'edu@sprout.test'`)
  const [profile] = await sql('select username, timezone from profiles where id = $1', [userId])
  check('cadastro cria o profile com username e fuso do navegador', profile?.username === 'edu' && !!profile?.timezone, JSON.stringify(profile))

  const gardenA = await createGarden(page, 'Faculdade')
  await page.goto(APP, { waitUntil: 'networkidle0' })
  const gardenB = await createGarden(page, 'Treino', '#7fb4f0')
  check('dois jardins criados', !!gardenA && !!gardenB)
  await page.goto(APP, { waitUntil: 'networkidle0' })
  await page.screenshot({ path: join(OUT, 'jardins.png') })

  section('Fase 2 · update direto em plants é bloqueado')
  const patchPlants = await rawApi(page, 'PATCH', `/rest/v1/plants?garden_id=eq.${gardenA}`, { growth: 10, status: 'grown' })
  check('PATCH /plants com o token do usuário dá 403', patchPlants.status === 403, patchPlants.body.slice(0, 80))
  const fakeSession = await rawApi(page, 'POST', '/rest/v1/sessions', { garden_id: gardenA, planned_minutes: 25, status: 'completed' })
  check('POST /sessions (sessão inventada) dá 403', fakeSession.status === 403)
  const anonRpc = await page.evaluate(async (url, gardenId) => {
    const res = await fetch(`${url}/rest/v1/rpc/start_session`, {
      method: 'POST',
      headers: { apikey: 'sb_publishable_local', 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_garden_id: gardenId }),
    })
    return res.status
  }, api.url, gardenA)
  check('visitante sem login não chama RPC (401)', anonRpc === 401)

  section('Fase 2 · o tempo da sessão é medido só pelo banco')
  const cheatStart = await rawApi(page, 'POST', '/rest/v1/rpc/start_session', { p_garden_id: gardenB })
  const cheatId = JSON.parse(cheatStart.body).id
  const cheatFinish = await rawApi(page, 'POST', '/rest/v1/rpc/finish_session', { p_session_id: cheatId, p_exits: 0 })
  const cheat = JSON.parse(cheatFinish.body)
  check('chamar finish_session logo após começar devolve "invalid"', cheat.status === 'invalid' && cheat.fail_reason === 'bad_timing', `${cheat.status}/${cheat.fail_reason}`)
  const [cheatPlant] = await sql('select status, growth from plants where garden_id = $1', [gardenB])
  check('a planta do jardim B não cresceu nem morreu', cheatPlant?.status === 'growing' && cheatPlant?.growth === 0)

  await page.goto(`${APP}/jardim/${gardenA}/foco`, { waitUntil: 'networkidle0' })
  await startFocus(page)
  const s1 = await activeSession(userId)
  const [{ drift }] = await sql(`select abs(extract(epoch from now() - $1::timestamptz))::float8 as drift`, [s1.started_at])
  check('início da sessão é o now() do banco', drift < 5, `${drift.toFixed(2)} s atrás`)
  await page.screenshot({ path: join(OUT, 'foco.png') })
  await completeFocus(page, userId, s1.planned_minutes)
  const done1 = await sql('select status, growth_points from sessions where id = $1', [s1.id])
  const [plantA] = await sql(`select * from plants where garden_id = $1 and status = 'growing'`, [gardenA])
  check('sessão honesta concluída pelo servidor e planta com 2 de 10', done1[0]?.status === 'completed' && plantA?.growth === 2, `growth=${plantA?.growth}`)
  check('tela mostra "+2 de crescimento"', (await text(page)).includes('+2 de crescimento'))
  await page.screenshot({ path: join(OUT, 'revisao-resultado.png') })

  section('Fase 3 · cada sessão concluída aparece crescendo na cena do jardim certo')
  let scene = await waitScene(page, (s) => s.growing?.growth === 2)
  check('cena do jardim A: planta da vez com 2 de 10 (broto)', scene?.growing?.gardenId === gardenA && scene.growing.plantId === plantA.id && scene.growing.stage === 'broto', JSON.stringify(scene?.growing))
  await page.screenshot({ path: join(OUT, 'cena-A-broto.png') })

  await page.goto(`${APP}/jardim/${gardenB}`, { waitUntil: 'networkidle0' })
  scene = await waitScene(page, (s) => s.growing?.gardenId === gardenB)
  check('cena do jardim B: a semente da sessão trapaceada continua com 0', scene?.growing?.growth === 0 && scene.growing.stage === 'semente', JSON.stringify(scene?.growing))

  await page.goto(`${APP}/jardim/${gardenB}/foco`, { waitUntil: 'networkidle0' })
  await startFocus(page)
  const sB = await activeSession(userId)
  await completeFocus(page, userId, sB.planned_minutes, 'Mais ou menos')
  scene = await waitScene(page, (s) => s.growing?.growth === 1)
  check('sessão "mais ou menos" no B: a cena do B mostra a planta com 1', scene?.growing?.gardenId === gardenB && scene.growing.growth === 1, JSON.stringify(scene?.growing))

  await page.goto(`${APP}/jardim/${gardenA}`, { waitUntil: 'networkidle0' })
  scene = await waitScene(page, (s) => s.growing?.gardenId === gardenA)
  check('a cena do A não mudou com a sessão do B (continua 2)', scene?.growing?.growth === 2, JSON.stringify(scene?.growing))

  section('Foco em segundo plano: dá pra usar outro app sem perder a planta')
  await page.goto(`${APP}/jardim/${gardenA}/foco`, { waitUntil: 'networkidle0' })
  await startFocus(page)
  await waitScene(page, (s) => s.growing?.gardenId === gardenA)
  const s2 = await activeSession(userId)
  // janela sem foco (clicou no VS Code) e, depois, outra aba na frente
  await page.evaluate(() => {
    window.__realHasFocus = document.hasFocus.bind(document)
    document.hasFocus = () => false
    window.dispatchEvent(new Event('blur'))
  })
  await other.bringToFront()
  const beatBefore = (await activeSession(userId))?.last_heartbeat_at
  await sleep(32_000)
  const away = await sql('select s.status, s.last_heartbeat_at, p.status as plant from sessions s join plants p on p.id = s.plant_id where s.id = $1', [s2.id])
  check('32 s em outra aba: sessão continua ativa e planta viva', away[0]?.status === 'active' && away[0]?.plant === 'growing', JSON.stringify({ status: away[0]?.status, plant: away[0]?.plant }))
  check('o heartbeat continua chegando com a aba em segundo plano', !!beatBefore && new Date(away[0]?.last_heartbeat_at) > new Date(beatBefore))
  await page.bringToFront()
  await page.evaluate(() => {
    document.hasFocus = window.__realHasFocus
    window.dispatchEvent(new Event('focus'))
  })
  await sleep(800)
  check('de volta à aba: o timer segue rodando, sem aviso', !!(await page.$('[role=timer]')) && !(await text(page)).includes('A planta morreu'))

  section('Desistir mata a planta (e ela fica seca no jardim)')
  await click(page, 'Desistir')
  await click(page, 'Desistir mesmo')
  await waitText(page, 'A planta morreu')
  await sleep(500)
  const failed = await sql('select s.status, s.fail_reason, p.status as plant from sessions s join plants p on p.id = s.plant_id where s.id = $1', [s2.id])
  check('desistiu: sessão "failed" e planta morta no banco', failed[0]?.status === 'failed' && failed[0]?.fail_reason === 'gave_up' && failed[0]?.plant === 'dead', JSON.stringify(failed[0]))
  scene = await waitScene(page, (s) => s.instanced.some((g) => g.name.endsWith(':dead') && g.ids.includes(s2.plant_id)))
  check('a planta morta continua na cena, seca', !!scene?.instanced.some((g) => g.name.endsWith(':dead') && g.ids.includes(s2.plant_id)) && !scene.growing)
  await page.screenshot({ path: join(OUT, 'cena-A-planta-seca.png') })

  section('Fase 1 de novo, agora com servidor: mexer no relógio')
  await click(page, 'Voltar')
  await startFocus(page)
  const s3 = await activeSession(userId)
  check('a próxima sessão planta uma semente nova', s3.plant_id !== s2.plant_id)
  await sleep(1_000)
  await page.evaluate(() => {
    const real = Date.now
    Date.now = () => real() + 90_000
  })
  await waitText(page, 'Sessão inválida')
  await sleep(500)
  const invalid = await sql('select s.status, s.fail_reason, p.status as plant from sessions s join plants p on p.id = s.plant_id where s.id = $1', [s3.id])
  check('relógio mexido: sessão "invalid" e planta viva no banco', invalid[0]?.status === 'invalid' && invalid[0]?.fail_reason === 'clock_changed' && invalid[0]?.plant === 'growing', JSON.stringify(invalid[0]))

  section('Fase 3 · planta adulta')
  // a planta do B está com 1: mais 5 sessões honestas (+2 cada) e ela fica adulta
  let adult
  for (let i = 0; i < 5; i++) {
    await page.goto(`${APP}/jardim/${gardenB}/foco`, { waitUntil: 'networkidle0' })
    await waitScene(page, (s) => s.growing?.gardenId === gardenB)
    await startFocus(page)
    const s = await activeSession(userId)
    await completeFocus(page, userId, s.planned_minutes)
    adult = s.plant_id
  }
  check('tela avisa que a planta ficou adulta', (await text(page)).includes('Sua planta ficou adulta'))
  scene = await waitScene(page, (s) => s.burst)
  check('pétalas caem quando ela fica adulta', !!scene?.burst)
  await sleep(1_200)
  await page.screenshot({ path: join(OUT, 'cena-B-adulta-petalas.png') })
  scene = await waitScene(page, (s) => s.instanced.some((g) => g.name.endsWith(':10:grown') && g.ids.includes(adult)))
  check('a adulta fica no jardim (instanciada) e não há planta crescendo no B', !!scene?.instanced.some((g) => g.ids.includes(adult)) && !scene.growing)

  section('Fase 4 · sequência de honestidade vira selo no jardim')
  await page.goto(`${APP}/jardim/${gardenA}/foco`, { waitUntil: 'networkidle0' })
  await waitScene(page, (s) => s.growing?.gardenId === gardenA)
  await startFocus(page)
  const sNao = await activeSession(userId)
  await ageActiveSession(userId, sNao.planned_minutes)
  await advancePageClock(page, sNao.planned_minutes * 60_000)
  await waitText(page, 'Você focou de verdade?')
  await page.waitForFunction(() => !document.querySelector('[aria-label="Como foi o foco"] button')?.disabled, { timeout: 10_000 })
  await click(page, 'Não focou')
  await click(page, 'Celular')
  await click(page, 'Enviar resposta')
  await waitText(page, 'Valeu pela sinceridade')
  const [nao] = await sql('select focus_rating, distraction_tag, growth_points from sessions where id = $1', [sNao.id])
  check('"não" assumido: planta não cresce e a distração fica registrada', nao?.focus_rating === 'nao' && nao.distraction_tag === 'celular' && nao.growth_points === 0, JSON.stringify(nao))
  await page.goto(`${APP}/jardim/${gardenA}`, { waitUntil: 'networkidle0' })
  await waitText(page, 'Primeira sinceridade')
  scene = await waitScene(page, (s) => s.sign === 1)
  check('selo aparece no painel e como marco na ilha', scene?.sign === 1)
  await page.screenshot({ path: join(OUT, 'selo-honestidade.png') })

  section('Fase 4 · estatísticas')
  await page.goto(`${APP}/estatisticas`, { waitUntil: 'networkidle0' })
  await waitText(page, 'Minutos de foco por dia')
  const statsText = await text(page)
  // concluídas: A (sim, não) + B (mais ou menos, 5x sim) = 8 sessões de 25 min = 200 min
  await sleep(1_500) // os números dos tiles contam até o valor final
  const tiles = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('section[aria-label=Resumo] > div')].map((t) => [t.children[0].textContent, [...t.children].slice(1).map((c) => c.textContent).filter(Boolean).join(' | ')])))
  check('tempo de foco total: 3 h 20 min em 8 sessões', tiles['Tempo de foco'] === '3 h 20 min | 8 sessões', JSON.stringify(tiles['Tempo de foco']))
  check('sinceridade conta o "não" assumido', tiles['Sinceridade']?.startsWith('1 |'), tiles['Sinceridade'])
  // o teste pode atravessar a meia-noite: a sequência certa é a que o banco calcula
  const [{ current_streak: streak }] = await sql('select current_streak from user_streaks where user_id = $1', [userId])
  check('sequência atual igual à do banco (≥ 1 dia)', streak >= 1 && tiles['Sequência atual']?.startsWith(`${streak} dia`), `${tiles['Sequência atual']} / banco: ${streak}`)
  const bars = await page.evaluate(() =>
    [...document.querySelectorAll('ol li[aria-label]')].map((li) => li.getAttribute('aria-label')).filter((label) => !label.endsWith('sem foco')),
  )
  check('gráfico por dia mostra os dias com foco (com o total do banco)', bars.length >= 1 && bars.some((b) => b.includes('min')), bars.join(' / '))
  check('tempo por jardim: Treino 2 h 30 min, Faculdade 50 min', statsText.includes('2 h 30 min') && statsText.includes('50 min'))
  check('distrações listam o celular', /Celular\s+1×/.test(statsText))
  await page.screenshot({ path: join(OUT, 'estatisticas.png'), fullPage: true })

  section('Fase 4 · 3 dias sem sessão: folhas amarelam')
  await sql(`update gardens set created_at = now() - interval '6 days' where id = $1`, [gardenB])
  await sql(`update sessions set ended_at = ended_at - interval '4 days', started_at = started_at - interval '4 days' where garden_id = $1`, [gardenB])
  await page.goto(`${APP}/jardim/${gardenB}`, { waitUntil: 'networkidle0' })
  await waitText(page, 'as folhas amarelaram')
  scene = await waitScene(page, (s) => s.yellow > 0)
  check('jardim esquecido: aviso no painel e grama/folhas amarelando na cena', (scene?.yellow ?? 0) > 0.5, `uYellow ${scene?.yellow}`)
  await page.screenshot({ path: join(OUT, 'jardim-esquecido.png') })
  await page.goto(`${APP}/jardim/${gardenB}/foco`, { waitUntil: 'networkidle0' })
  await startFocus(page)
  const sBack = await activeSession(userId)
  await completeFocus(page, userId, sBack.planned_minutes)
  scene = await waitScene(page, (s) => s.yellow === 0)
  check('uma sessão concluída volta tudo ao normal', scene?.yellow === 0)

  section('Amigos · pedido, quadro da semana, visita e presentes')
  const newUser = async (username) =>
    (await sql(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [`${username}@sprout.test`, JSON.stringify({ username })]))[0].id
  const amigaId = await newUser('amiga')
  const estranhoId = await newUser('estranho')
  // a amiga tem um jardim com uma árvore crescendo e 40 min concluídos nesta semana
  const [amigaGarden] = await sql(`insert into gardens (user_id, name) values ($1, 'Leitura') returning id`, [amigaId])
  const [amigaPlant] = await sql(
    `insert into plants (garden_id, user_id, species, growth, status, position_x, position_z) values ($1, $2, 'pinheiro', 4, 'growing', 0.6, 0.4) returning id`,
    [amigaGarden.id, amigaId],
  )
  await sql(
    `insert into sessions (user_id, garden_id, plant_id, planned_minutes, started_at, last_heartbeat_at, ended_at, status)
     values ($1, $2, $3, 40, now() - interval '41 minutes', now(), now() - interval '1 minute', 'completed')`,
    [amigaId, amigaGarden.id, amigaPlant.id],
  )

  await page.goto(`${APP}/amigos`, { waitUntil: 'networkidle0' })
  await page.type('input[aria-label="Nome de usuário do amigo"]', 'amiga')
  await click(page, 'Mandar pedido')
  await waitText(page, 'Pedido enviado pra @amiga')
  const [request] = await sql('select status from friendships where requester_id = $1 and addressee_id = $2', [userId, amigaId])
  check('pedido pelo nome fica pendente até ela aceitar', request?.status === 'pending' && !(await text(page)).includes('40 min'))
  // ela aceita (no celular dela; aqui direto no banco)
  await sql(`update friendships set status = 'accepted', accepted_at = now() where requester_id = $1 and addressee_id = $2`, [userId, amigaId])
  await page.reload({ waitUntil: 'networkidle0' })
  await waitText(page, '40 min')
  const board = await text(page)
  check('aceito: a amiga entra no quadro da semana com os 40 min dela', board.includes('@amiga') && board.includes('40 min'))

  await click(page, 'Visitar jardim')
  await page.waitForFunction((id) => location.pathname === `/amigos/${id}`, { timeout: 10_000 }, amigaId)
  scene = await waitScene(page, (s) => s.growing?.gardenId === amigaGarden.id)
  check('visita: a ilha da amiga aparece com a árvore dela', scene?.growing?.plantId === amigaPlant.id, JSON.stringify(scene?.growing))
  await page.evaluate(() => {
    const input = document.querySelector('input[inputmode=numeric]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '7')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await click(page, 'Mandar 7 corações')
  await waitText(page, '7 corações enviados')
  await click(page, 'Regar o jardim')
  await waitText(page, 'Regado hoje')
  const sent = await sql(`select kind, sum(amount)::int as n from gifts where from_id = $1 and to_id = $2 group by kind order by kind`, [userId, amigaId])
  check('presentes gravados: 7 corações e 1 rega', JSON.stringify(sent) === JSON.stringify([{ kind: 'heart', n: 7 }, { kind: 'water', n: 1 }]), JSON.stringify(sent))
  const plantAfter = await sql('select growth, status from plants where id = $1', [amigaPlant.id])
  check('presente não mexe na árvore dela', plantAfter[0]?.growth === 4 && plantAfter[0]?.status === 'growing')
  const twice = await rawApi(page, 'POST', '/rest/v1/rpc/send_gift', { p_to: amigaId, p_kind: 'water' })
  check('regar de novo no mesmo dia é recusado (SP008)', twice.status >= 400 && twice.body.includes('SP008'), twice.body.slice(0, 80))
  const stranger = await rawApi(page, 'POST', '/rest/v1/rpc/friend_gardens', { p_user: estranhoId })
  check('jardim de quem não é amigo não abre (SP007)', stranger.status >= 400 && stranger.body.includes('SP007'), stranger.body.slice(0, 80))

  // a amiga manda presentes de volta: aparecem quando ele abre o Sprout
  await sql(`insert into gifts (from_id, to_id, kind, amount) values ($1, $2, 'water', 1), ($1, $2, 'heart', 999)`, [amigaId, userId])
  await page.goto(APP, { waitUntil: 'networkidle0' })
  // (o título do bilhete fica em maiúsculas pelo CSS, e o innerText devolve assim: espera a frase)
  const noteShown = await waitText(page, '@amiga regou seu jardim e mandou 999 corações').then(() => true, () => false)
  check('bilhete de presente diz quem mandou e quanto', noteShown)
  const cloud = await page
    .waitForFunction(() => {
      let found = false
      window.__sprout3d?.scene.traverse((o) => {
        if (o.name === 'heart-cloud' || o.name === 'watering-can') found = true
      })
      return found
    }, { timeout: 10_000 })
    .then(() => true)
    .catch(() => false)
  check('o regador e os corações tocam na ilha em destaque', cloud)
  await page.screenshot({ path: join(OUT, 'presentes-recebidos.png') })
  let unseen
  for (let i = 0; i < 20 && unseen !== 0; i++) {
    await sleep(250)
    ;[{ n: unseen }] = await sql('select count(*)::int as n from gifts where to_id = $1 and seen_at is null', [userId])
  }
  check('depois de aparecer, os presentes ficam marcados como vistos', unseen === 0)

  const [{ invite_code: code }] = await sql('select invite_code from profiles where id = $1', [estranhoId])
  await page.goto(`${APP}/amigo/${code}`, { waitUntil: 'networkidle0' })
  await waitText(page, '@estranho te chamou pro Sprout')
  await click(page, 'Aceitar convite')
  await page.waitForFunction(() => location.pathname === '/amigos', { timeout: 10_000 })
  const [invited] = await sql(
    `select status from friendships where (requester_id = $1 and addressee_id = $2) or (requester_id = $2 and addressee_id = $1)`,
    [userId, estranhoId],
  )
  check('link de convite aceito vira amizade na hora', invited?.status === 'accepted', JSON.stringify(invited))

  section('Saídas da página durante o foco')
  // documento novo zera os relógios falsos; o "Focar agora" navega dentro do app,
  // então o "voltar" do navegador fica dentro do app e o bloqueio consegue segurar
  await page.goto(`${APP}/jardim/${gardenA}`, { waitUntil: 'networkidle0' })
  await click(page, 'Focar agora')
  await startFocus(page)
  await page.evaluate(() => history.back())
  await waitText(page, 'Sair do foco?')
  check('navegar durante o foco pede confirmação', true)
  await click(page, 'Continuar focando', 'dialog[open]')
  await sleep(300)
  check('"Continuar focando" mantém a sessão', !!(await activeSession(userId)))

  const tab2 = await newPage()
  await tab2.goto(`${APP}/jardim/${gardenB}/foco`, { waitUntil: 'networkidle0' })
  await waitText(tab2, 'Tem uma sessão em andamento')
  check('segunda aba vê a sessão da primeira e não deixa começar outra', true)
  await tab2.close()
  await page.bringToFront()
  await sleep(300)

  const s4 = await activeSession(userId)
  await page.close({ runBeforeUnload: false })
  let closed
  for (let i = 0; i < 20 && closed?.status !== 'failed'; i++) {
    await sleep(250)
    ;[closed] = await sql('select status, fail_reason from sessions where id = $1', [s4.id])
  }
  check('fechar a aba no foco avisa o servidor (keepalive): sessão "failed"', closed?.status === 'failed' && closed?.fail_reason === 'page_closed', JSON.stringify(closed))
} catch (error) {
  failures++
  console.error('\nErro no roteiro:', error)
} finally {
  await browser.close()
  await vite.close()
  await api.close()
}

if (pageErrors.length) {
  console.log('\nErros no console da página:')
  for (const message of [...new Set(pageErrors)]) console.log(`  - ${message}`)
}
console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTodos os critérios conferidos')
process.exit(failures ? 1 : 0)
