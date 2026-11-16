// Conferência visual da cena: sobe o Supabase local + o app no Chrome, monta um jardim de
// mentira e fotografa a ilha em várias horas do dia, nas quatro estações, com e sem chuva,
// mais a tela de foco e uma folha com vários avatares.
//
// Não é teste (não passa nem falha): é pra olhar. Uso: node e2e/visual.mjs
// As fotos ficam em e2e/output/visual/.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { createServer } from 'vite'
import { startLocalSupabase } from '../scripts/local-supabase.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'e2e', 'output', 'visual')
const API_PORT = 54331
const APP_PORT = 5181
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

mkdirSync(OUT, { recursive: true })
const api = await startLocalSupabase({ port: API_PORT })
process.env.VITE_SUPABASE_URL = api.url
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_local'
const vite = await createServer({ root: ROOT, mode: 'localdb', logLevel: 'warn', server: { port: APP_PORT, strictPort: true } })
await vite.listen()
const APP = `http://localhost:${APP_PORT}`
const sql = async (q, p = []) => (await api.db.query(q, p)).rows

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  // GPU de verdade: sem isso o WebGL cai no SwiftShader e fica lentíssimo
  args: ['--no-first-run', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'],
})

async function click(page, label) {
  await page.waitForFunction(
    (l) => [...document.querySelectorAll('button, a')].some((e) => e.innerText.split('\n')[0].trim() === l && !e.disabled),
    { timeout: 15000 },
    label,
  )
  await page.evaluate(
    (l) => [...document.querySelectorAll('button, a')].find((e) => e.innerText.split('\n')[0].trim() === l && !e.disabled).click(),
    label,
  )
}

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 860 })
  page.on('pageerror', (e) => console.log('ERRO NA PAGINA:', e.message))
  page.on('dialog', (d) => d.accept()) // o foco em andamento pergunta antes de sair da aba

  await page.goto(`${APP}/criar-conta`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('input[autocomplete=username]')
  await page.type('input[type=email]', 'visual@sprout.test')
  for (const input of await page.$$('input[type=password]')) await input.type('senha-forte-123')
  await page.type('input[autocomplete=username]', 'edu')
  await page.click('form button[type=submit]')
  await page.waitForFunction(() => document.body.innerText.includes('Plante o primeiro jardim'), { timeout: 20000 })
  const [{ id: userId }] = await sql(`select id from auth.users where email = 'visual@sprout.test'`)

  /** Jardim de mentira com árvores já crescidas: aqui é cenário pra foto, não teste de regra. */
  async function garden(name, color, biome) {
    const [g] = await sql(
      `insert into gardens (user_id, name, color, biome, focus_minutes, break_minutes) values ($1,$2,$3,$4,25,5) returning *`,
      [userId, name, color, biome],
    )
    const spots = [
      [2.4, 1.1, 'macieira', 10, 'grown'],
      [-2.1, 2.0, 'cerejeira', 10, 'grown'],
      [0.4, -2.6, 'pinheiro', 10, 'grown'],
      [3.1, -1.4, 'macieira', 10, 'grown'],
      [-3.0, -0.9, 'cerejeira', 10, 'grown'],
      [1.2, 3.2, 'pinheiro', 6, 'dead'],
      [-1.0, 0.2, 'macieira', 7, 'growing'],
    ]
    for (const [x, z, species, growth, status] of spots) {
      await sql(
        `insert into plants (garden_id, user_id, species, growth, status, position_x, position_z) values ($1,$2,$3,$4,$5,$6,$7)`,
        [g.id, userId, species, growth, status, x, z],
      )
    }
    return g.id
  }

  const campo = await garden('Faculdade', '#f08fb0', 'campo')
  const neve = await garden('Ingles', '#7fb4f0', 'neve')

  async function shot(name, url, wait = 3500) {
    await page.goto(url, { waitUntil: 'networkidle0' })
    await sleep(wait)
    await page.screenshot({ path: join(OUT, `${name}.png`) })
    console.log('  foto:', name)
  }

  console.log('\nLuz pela hora do dia')
  for (const [name, hora] of [
    ['hora-06-amanhecer', 6],
    ['hora-12-meiodia', 12],
    ['hora-18-tarde', 18],
    ['hora-22-noite', 22],
  ]) {
    await shot(name, `${APP}/jardim/${campo}?hora=${hora}`)
  }

  console.log('\nEstacoes (ao meio-dia)')
  for (const estacao of ['primavera', 'verao', 'outono', 'inverno']) {
    await shot(`estacao-${estacao}`, `${APP}/jardim/${campo}?hora=12&estacao=${estacao}`)
  }

  console.log('\nNeve')
  await shot('neve-meiodia', `${APP}/jardim/${neve}?hora=12`)
  await shot('neve-noite', `${APP}/jardim/${neve}?hora=22`)

  console.log('\nChuva no dia da perda')
  const [morta] = await sql(`select id from plants where garden_id = $1 and status = 'dead' limit 1`, [campo])
  await sql(
    `insert into sessions (user_id, garden_id, plant_id, planned_minutes, started_at, last_heartbeat_at, ended_at, status, fail_reason)
     values ($1,$2,$3,25, now() - interval '30 minutes', now() - interval '30 minutes', now() - interval '5 minutes', 'failed', 'gave_up')`,
    [userId, campo, morta.id],
  )
  await shot('chuva-tarde', `${APP}/jardim/${campo}?hora=15`)
  await shot('chuva-noite', `${APP}/jardim/${campo}?hora=21`)

  console.log('\nTela de foco (chips de som)')
  await page.goto(`${APP}/jardim/${neve}/foco`, { waitUntil: 'networkidle0' })
  await click(page, 'Começar foco')
  await page.waitForSelector('[role=timer]', { timeout: 15000 })
  await sleep(2500)
  await page.screenshot({ path: join(OUT, 'foco-som.png') })
  console.log('  foto: foco-som')
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll('[role=radiogroup][aria-label="Som ambiente"] [role=radio]')].map(
      (b) => `${b.innerText}:${b.getAttribute('aria-checked')}`,
    ),
  )
  console.log('  chips de som:', JSON.stringify(chips))

  console.log('\nCervinho (os quatro números)')
  // a surpresa só aparece nos jardins de duas contas, pelo id. Aqui se cria uma conta com um
  // desses ids (mesma senha da outra) só pra poder ver o cervinho.
  await sql(`update sessions set status = 'abandoned', ended_at = now() where status = 'active'`) // sai do foco que ficou aberto
  const EDU = 'e186f8e3-25da-4ad2-8e63-69cb984807b9'
  await sql(
    `insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
     select $1, 'edu@sprout.test', encrypted_password, '{"username":"eduardo","timezone":"America/Sao_Paulo"}'::jsonb
       from auth.users where email = 'visual@sprout.test'`,
    [EDU],
  )
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${APP}/entrar`, { waitUntil: 'networkidle0' })
  await page.type('input[type=email]', 'edu@sprout.test')
  await page.type('input[type=password]', 'senha-forte-123')
  await page.click('form button[type=submit]')
  await page.waitForFunction(() => !location.pathname.startsWith('/entrar'), { timeout: 20000 })

  const [pasto] = await sql(
    `insert into gardens (user_id, name, color, biome, focus_minutes, break_minutes)
     values ($1,'Pasto','#f2c14e','campo',25,5) returning *`,
    [EDU],
  )
  for (const [x, z, species, growth, status] of [
    [2.6, 1.3, 'macieira', 10, 'grown'],
    [-2.3, 1.8, 'cerejeira', 10, 'grown'],
    [0.6, -2.4, 'pinheiro', 10, 'grown'],
    [-1.2, 0.4, 'macieira', 6, 'growing'],
  ]) {
    await sql(`insert into plants (garden_id, user_id, species, growth, status, position_x, position_z) values ($1,$2,$3,$4,$5,$6,$7)`, [
      pasto.id,
      EDU,
      species,
      growth,
      status,
      x,
      z,
    ])
  }

  // o relógio do cervinho é exposto em desenvolvimento: dá pra congelar e escolher o instante
  const CLIP = { x: 230, y: 170, width: 700, height: 560 }
  // instantes de cada número (a cena toda dura uns 6 a 8 s, dependendo do número e dos pulos)
  const MARKS = {
    chegada: [1.4, 1.8, 2.2, 2.6, 3.6, 5.2, 5.8],
    pastando: [1.8, 2.5, 3.2, 3.9, 4.8, 6.0, 7.0],
    sacudida: [1.8, 2.4, 2.8, 3.2, 4.2, 5.6, 6.4],
    pulinho: [1.8, 2.5, 2.9, 3.3, 4.2, 5.5, 6.3],
  }
  // congela o relógio do cervinho no instante em que ele aparece: a cena dura uns 7 s e, do
  // lado de fora, a página demora o bastante carregando pra ele já ter ido embora
  await page.evaluateOnNewDocument(() => {
    let held
    Object.defineProperty(window, '__sproutFawn', {
      configurable: true,
      get: () => held,
      set: (value) => {
        held = value
        if (value) value.hold = true
      },
    })
  })
  const rows = []
  for (const act of ['chegada', 'pastando', 'sacudida', 'pulinho']) {
    await page.goto(`${APP}/jardim/${pasto.id}?cervo=${act}&hora=12`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.__sproutFawn, { timeout: 25000 })
    const marks = MARKS[act]
    const frames = []
    const shown = []
    for (const mark of marks) {
      // quando ele some atrás da árvore o componente sai de cena e o relógio some junto
      const alive = await page.evaluate((m) => {
        if (!window.__sproutFawn) return false
        window.__sproutFawn.t = m
        return true
      }, mark)
      if (!alive) break
      await sleep(260)
      frames.push(await page.screenshot({ encoding: 'base64', clip: CLIP }))
      shown.push(mark)
    }
    rows.push({ act, frames, marks: shown })
    console.log('  número:', act, '→', frames.length, 'quadros')
  }
  const strip = rows
    .map(
      (r) =>
        `<div class="strip"><h2>${r.act}</h2><div class="frames">${r.frames
          .map((f, i) => `<figure><img src="data:image/png;base64,${f}"><figcaption>${r.marks[i].toFixed(1)} s</figcaption></figure>`)
          .join('')}</div></div>`,
    )
    .join('')
  const stripStyle = [
    'body{background:#f3eee2;font-family:Georgia,serif;color:#2a2823;margin:0;padding:16px}',
    'h2{font-size:15px;margin:10px 0 4px;text-transform:uppercase;letter-spacing:.08em}',
    '.frames{display:flex;gap:6px}',
    'figure{margin:0;flex:1}',
    'img{width:100%;display:block;border:1px solid #d8cfbb}',
    'figcaption{font-family:monospace;font-size:10px;color:#6f685b;text-align:center}',
  ].join('')
  await page.setViewport({ width: 2600, height: 1800 })
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${stripStyle}</style>${strip}`, { waitUntil: 'load' })
  await sleep(500)
  await page.screenshot({ path: join(OUT, 'cervinho.png'), fullPage: true })
  console.log('  foto: cervinho')

  console.log('\nAvatares')
  const sprigs = await page.evaluate(async () => {
    const mod = await import('/src/features/friends/sprig.ts')
    const ids = Array.from({ length: 12 }, (_, i) => `pessoa-${i}-${'abcdefghijkl'[i]}`)
    return ids.map((id) => ({ id, ...mod.sprigOf(id) }))
  })
  const cells = sprigs
    .map((s) => {
      const leaves = s.leaves.map((d) => `<path class="leaf" fill="${s.leafColor}" d="${d}"/>`).join('')
      const tipFill = s.tip.kind === 'cacho' ? 'none' : s.accent
      return `<div class="cell"><span class="avatar" style="background:color-mix(in srgb, ${s.accent} 26%, #f8f4ea)"><svg viewBox="0 0 24 32"><path class="stem" d="${s.stem}"/>${leaves}<path class="tip" fill="${tipFill}" d="${s.tip.d}"/></svg></span><span>${s.tip.kind}</span></div>`
    })
    .join('')
  const style = [
    'body{background:#f3eee2;font-family:Georgia,serif;color:#2a2823;padding:28px;margin:0}',
    '.row{display:flex;flex-wrap:wrap;gap:22px}',
    '.cell{display:grid;justify-items:center;gap:6px;font-size:12px;color:#6f685b}',
    '.avatar{display:inline-grid;place-items:center;width:76px;height:76px;border-radius:47% 53% 49% 51% / 54% 46% 54% 46%;box-shadow:inset 0 0 0 1px rgba(42,40,35,.18)}',
    'svg{width:64%;height:72%;overflow:visible}',
    '.stem{fill:none;stroke:#2a2823;stroke-width:1.4;stroke-linecap:round}',
    '.tip{stroke:#2a2823;stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}',
    '.leaf{stroke:#2a2823;stroke-width:1;stroke-linejoin:round}',
  ].join('')
  const html = `<!doctype html><meta charset="utf-8"><style>${style}</style><div class="row">${cells}</div>`
  writeFileSync(join(OUT, 'avatares.html'), html)
  await page.setViewport({ width: 1100, height: 340 })
  // setContent em vez de abrir o arquivo: o Chrome sem tela trava navegando de http:// pra file://
  await page.setContent(html, { waitUntil: 'load' })
  await sleep(400)
  await page.screenshot({ path: join(OUT, 'avatares.png') })
  console.log('  foto: avatares')

  console.log('\nFotos em', OUT)
} catch (error) {
  console.log('\nDEU RUIM:', error?.message ?? error)
} finally {
  await browser.close()
  await vite.close()
  if (api.stop) await api.stop()
  process.exit(0)
}
