// O movimento do cervinho da surpresa (ver src/three/Fawn.tsx), todo em funções puras:
// dado o tempo, devolvem a pose (ângulo de cada perna, pescoço, orelhas, rabo) e por onde ele
// anda. Nada aqui conhece o three.js nem a tela, então dá pra testar no Vitest.
//
// A cena em três atos: entra pulando, para e olha pra câmera, leva um susto e corre pra trás
// da árvore velha. O caminho da fuga é descrito em relação à câmera ("a" = pro lado, "b" = pra
// perto da câmera, com a árvore na origem): assim ele sempre passa por trás do tronco, de
// qualquer ângulo.
import { clamp, hashString, lerp, rng, smooth } from './random'

const TAU = Math.PI * 2

export interface Vec2 {
  x: number
  z: number
}

/** Ângulos de uma perna, em radianos: positivo leva o casco pra trás. */
export interface LegPose {
  upper: number
  lower: number
}

export interface FawnPose {
  /** altura do casco mais baixo acima do chão (pulo) */
  lift: number
  /** inclinação do corpo no ar: positivo = focinho pra baixo */
  pitch: number
  /** tombo lateral do corpo: o peso caindo pra um lado no pulo, e a sacudida */
  roll: number
  /** 1 = patas no chão (a inclinação é calculada pra todas tocarem), 0 = no ar */
  grounded: number
  /** achatar/esticar o corpo (1 = normal) */
  squash: number
  /** pernas [esquerda, direita] */
  front: [LegPose, LegPose]
  hind: [LegPose, LegPose]
  /** pescoço: 0 = em pé, maior = esticado pra frente */
  neck: number
  headPitch: number
  /** cabeça de ladinho (curiosidade) */
  headRoll: number
  /** 0 a 1: quanto a cabeça segue a câmera */
  look: number
  /** orelhas [esquerda, direita]: -1 = deitadas pra trás, 0 = soltas, 1 = em pé */
  ears: [number, number]
  /** 0 = rabo baixo, 1 = em pé mostrando o branco */
  tail: number
  tailWag: number
  /** 0 = olho aberto, 1 = fechado */
  blink: number
}

/** Medidas do esqueleto (unidades da cena, antes da escala). A geometria usa as mesmas. */
export const RIG = {
  /** altura do meio do tronco: o corpo gira em volta daqui */
  pivotY: 0.236,
  front: { x: 0.036, y: 0.215, z: 0.1, upper: 0.105, lower: 0.11 },
  hind: { x: 0.04, y: 0.225, z: -0.112, upper: 0.115, lower: 0.118 },
  /** perna de trás parada: coxa pra trás, canela voltando pra frente (o "joelho ao contrário") */
  hindRest: { upper: 0.38, lower: -0.46 },
  neck: { y: 0.262, z: 0.124, length: 0.108 },
  tail: { y: 0.272, z: -0.166 },
}

type Pair = 'front' | 'hind'

/** Altura do casco (0 = chão com o corpo parado) pra uma perna, com o corpo inclinado `pitch`. */
export function footY(pair: Pair, leg: LegPose, pitch: number): number {
  const j = RIG[pair]
  const hip = RIG.pivotY + (j.y - RIG.pivotY) * Math.cos(pitch) - j.z * Math.sin(pitch)
  return hip - j.upper * Math.cos(pitch + leg.upper) - j.lower * Math.cos(pitch + leg.upper + leg.lower)
}

const lowest = (pair: Pair, legs: [LegPose, LegPose], pitch: number) => Math.min(footY(pair, legs[0], pitch), footY(pair, legs[1], pitch))

/**
 * Onde o corpo fica: a inclinação (no chão, a que faz as patas da frente e de trás tocarem
 * juntas) e a altura (o casco mais baixo nunca afunda no chão).
 */
export function settle(pose: FawnPose): { pitch: number; y: number } {
  let pitch = pose.pitch
  if (pose.grounded > 0) {
    // método da secante: acha a inclinação em que os dois pares de patas ficam na mesma altura
    const gap = (p: number) => lowest('front', pose.front, p) - lowest('hind', pose.hind, p)
    let p0 = 0
    let p1 = 0.05
    for (let i = 0; i < 8; i++) {
      const g0 = gap(p0)
      const g1 = gap(p1)
      if (Math.abs(g1 - g0) < 1e-9) break
      const next = clamp(p1 - (g1 * (p1 - p0)) / (g1 - g0), -0.6, 0.6)
      p0 = p1
      p1 = next
    }
    pitch = lerp(pose.pitch, p1, pose.grounded)
  }
  const low = Math.min(lowest('front', pose.front, pitch), lowest('hind', pose.hind, pitch))
  return { pitch, y: pose.lift - low }
}

// ---------- poses ----------

const leg = (upper: number, lower: number): LegPose => ({ upper, lower })

function stand(): FawnPose {
  const h = RIG.hindRest
  return {
    lift: 0,
    roll: 0,
    pitch: 0,
    grounded: 1,
    squash: 1,
    front: [leg(0, 0), leg(0, 0)],
    hind: [leg(h.upper, h.lower), leg(h.upper, h.lower)],
    neck: 0.5,
    headPitch: 0,
    headRoll: 0,
    look: 0,
    ears: [0.3, 0.3],
    tail: 0,
    tailWag: 0,
    blink: 0,
  }
}

function mixLeg(a: LegPose, b: LegPose, k: number): LegPose {
  return leg(lerp(a.upper, b.upper, k), lerp(a.lower, b.lower, k))
}

/** Mistura de duas poses (0 = a, 1 = b). */
export function mixPose(a: FawnPose, b: FawnPose, k: number): FawnPose {
  const n = (key: 'lift' | 'pitch' | 'roll' | 'grounded' | 'squash' | 'neck' | 'headPitch' | 'headRoll' | 'look' | 'tail' | 'tailWag' | 'blink') => lerp(a[key], b[key], k)
  return {
    lift: n('lift'),
    roll: n('roll'),
    pitch: n('pitch'),
    grounded: n('grounded'),
    squash: n('squash'),
    front: [mixLeg(a.front[0], b.front[0], k), mixLeg(a.front[1], b.front[1], k)],
    hind: [mixLeg(a.hind[0], b.hind[0], k), mixLeg(a.hind[1], b.hind[1], k)],
    neck: n('neck'),
    headPitch: n('headPitch'),
    headRoll: n('headRoll'),
    look: n('look'),
    ears: [lerp(a.ears[0], b.ears[0], k), lerp(a.ears[1], b.ears[1], k)],
    tail: n('tail'),
    tailWag: n('tailWag'),
    blink: n('blink'),
  }
}

/** Quadros-chave [tempo, ...valores], com entrada e saída suaves entre um e outro. */
function keys(table: number[][], u: number): number[] {
  let i = 0
  while (i < table.length - 2 && u > table[i + 1][0]) i++
  const a = table[i]
  const b = table[i + 1]
  const k = smooth(a[0], b[0], u)
  return a.slice(1).map((v, n) => lerp(v, b[n + 1], k))
}

/** Sobe de 0 a 1 e volta, em volta de `center` (largura total `width`). */
const bump = (t: number, center: number, width: number) => {
  const x = 1 - Math.abs((t - center) / (width / 2))
  return x <= 0 ? 0 : x * x * (3 - 2 * x)
}

/**
 * O mesmo bump, mas dando a volta no ciclo (u de 0 a 1 é circular). É o que o pouso precisa:
 * o tranco acontece no fim do pulo e o corpo ainda está voltando no começo do pulo seguinte.
 * Com o bump normal, o fim de um pulo não batia com o começo do outro e dava um tranco.
 */
const cycleBump = (u: number, center: number, width: number) => {
  const away = Math.abs((((u - center + 1.5) % 1) + 1) % 1 - 0.5)
  const x = 1 - away / (width / 2)
  return x <= 0 ? 0 : x * x * (3 - 2 * x)
}

// colunas: tempo | frente (coxa, canela) | trás (coxa, canela) | inclinação | pescoço | orelhas | rabo | achatar
const HOP = [
  [0.0, -0.38, 0.85, 0.85, -1.35, 0.0, 0.62, 0.35, 0.15, 0.93], // agachado, pronto pra pular
  [0.14, -0.8, 1.35, 0.98, -0.62, -0.3, 0.42, -0.35, 0.35, 1.05], // empurra com as de trás
  [0.5, -1.0, 1.7, 0.55, -1.55, -0.04, 0.5, -0.15, 0.75, 1.0], // no alto, tudo encolhido
  [0.8, -0.72, 0.3, 0.22, -1.05, 0.26, 0.58, 0.25, 0.45, 1.0], // estica as da frente pra pousar
  [0.9, -0.42, 0.4, 0.45, -1.05, 0.14, 0.68, 0.6, 0.25, 0.95],
  [1.0, -0.38, 0.85, 0.85, -1.35, 0.0, 0.62, 0.35, 0.15, 0.93],
]
const AIR_START = 0.12
const AIR_END = 0.9

/**
 * Um pulo (u de 0 a 1): agacha, sobe encolhendo as pernas, pousa. `height` = altura do pulo,
 * `roll` = quanto o corpo tomba pro lado no ar (o peso caindo, que tira o jeito de brinquedo
 * de corda). O tombo nasce e morre dentro do pulo, então um pulo emenda no outro sem tranco.
 */
export function hopPose(u: number, height: number, roll = 0): FawnPose {
  const at = (x: number) => keys(HOP, ((x % 1) + 1) % 1)
  const [fu, fl, hu, hl, pitch, neck, ears, tail, squash] = at(u)
  // o lado direito vai um tiquinho atrasado: as patas não se mexem como um carimbo
  const [rfu, rfl, rhu, rhl] = u < 0.04 || u > 0.96 ? [fu, fl, hu, hl] : at(u - 0.035)
  const v = clamp((u - AIR_START) / (AIR_END - AIR_START), 0, 1)
  const pose = stand()
  pose.lift = height * 4 * v * (1 - v)
  pose.pitch = pitch
  pose.roll = roll * 4 * v * (1 - v)
  pose.grounded = 1 - smooth(0.06, 0.16, u) + smooth(0.84, 0.95, u)
  // pouso: o corpo afunda um tico e volta, em vez de parar seco no chão
  pose.squash = squash - 0.055 * cycleBump(u, 0.945, 0.17) * (height > 0 ? 1 : 0)
  pose.front = [leg(fu, fl), leg(rfu, rfl)]
  pose.hind = [leg(hu, hl), leg(rhu, rhl)]
  pose.neck = neck + 0.1 * cycleBump(u, 0.95, 0.2)
  // as orelhas batem pra baixo no tranco do pouso
  const flop = 0.55 * cycleBump(u, 0.96, 0.18)
  pose.ears = [ears - flop, ears * 0.8 - flop * 1.2]
  pose.tail = tail
  return pose
}

/**
 * O feitio de cada pulo da entrada: nenhum sai igual ao outro. Varia a duração, a altura e o
 * lado pra onde o corpo tomba (alternado, como quem troca a perna de apoio). O último é mais
 * baixo e mais curto: ele está chegando, não arrancando.
 *
 * É sorteado com semente, então o mesmo `seed` dá sempre a mesma entrada (dá pra testar).
 */
export function hopShapes(hops: number, seed = 0): { seconds: number; height: number; roll: number }[] {
  const random = rng(hashString(`hop:${seed}:${hops}`))
  return Array.from({ length: hops }, (_, i) => {
    const last = i === hops - 1
    const slow = 0.9 + random() * 0.26
    return {
      seconds: HOP_SECONDS * (last ? 1.1 : slow),
      height: last ? 0.12 + random() * 0.03 : 0.17 + random() * 0.08,
      roll: (i % 2 === 0 ? 1 : -1) * (0.05 + random() * 0.05),
    }
  })
}

/** Quanto do pulo já andou pra frente (0 a 1): quase tudo acontece no ar. */
function hopAdvance(u: number): number {
  return 0.04 * smooth(0, AIR_START, u) + 0.92 * smooth(AIR_START, AIR_END, u) + 0.04 * smooth(AIR_END, 1, u)
}

export const LOOK_SECONDS = 2.9

/**
 * Parado, olhando pra ela (t em segundos desde o pouso): orelha mexe, cabeça de lado, pisca,
 * rabinho. `from` = a pose em que ele estava (o fim do número que acabou), pra emendar sem pulo.
 */
export function lookPose(t: number, from: FawnPose = hopPose(1, 0)): FawnPose {
  const pose = mixPose(from, stand(), smooth(0, 0.42, t))
  pose.look = smooth(0.2, 0.8, t)
  const alert = smooth(0.25, 0.65, t)
  pose.ears = [lerp(0.3, 1, alert), lerp(0.3, 1, alert) - 1.1 * bump(t, 1.1, 0.26) - 0.6 * bump(t, 1.42, 0.2)]
  pose.neck = lerp(pose.neck, 0.36, alert)
  pose.headRoll = 0.32 * (smooth(1.45, 1.75, t) - smooth(2.3, 2.6, t))
  pose.blink = Math.min(1, bump(t, 0.95, 0.16) + bump(t, 1.95, 0.16) + bump(t, 2.15, 0.16))
  const wag = bump(t, 2.15, 1.0)
  pose.tail = 0.3 * wag
  pose.tailWag = Math.sin((t - 1.65) * TAU * 4.5) * 0.6 * wag
  pose.squash = 1 + 0.008 * Math.sin(t * 4.2) // respirando
  return pose
}

// ---------- os números ----------
//
// Depois de chegar e antes de se assustar, ele faz alguma coisa. São quatro, e o jardim nunca
// mostra o mesmo duas vezes seguidas: sem isso, quem abre o jardim cinco vezes no dia vê a
// mesma cena cinco vezes. Todos terminam parado e olhando pra câmera, porque o fim (o susto e
// a corrida pra trás do tronco) é o mesmo pra todos.

export type FawnAct = 'chegada' | 'pastando' | 'sacudida' | 'pulinho'

export const FAWN_ACTS: FawnAct[] = ['chegada', 'pastando', 'sacudida', 'pulinho']

/** Quanto dura cada número e quanto ele fica olhando depois (quem fez mais, olha menos). */
const ACTS: Record<FawnAct, { seconds: number; look: number }> = {
  chegada: { seconds: 0, look: LOOK_SECONDS },
  pastando: { seconds: 2.7, look: 1.5 },
  sacudida: { seconds: 1.5, look: 1.8 },
  pulinho: { seconds: 1.5, look: 1.7 },
}

export const actSeconds = (act: FawnAct) => ACTS[act].seconds
export const lookSeconds = (act: FawnAct) => ACTS[act].look

/** O que ele está fazendo no número, `t` segundos depois de parar. */
export function actPose(act: FawnAct, t: number): FawnPose {
  const seconds = ACTS[act].seconds
  if (act === 'pastando') return grazePose(t, seconds)
  if (act === 'sacudida') return shakePose(t, seconds)
  if (act === 'pulinho') return pronkPose(t, seconds)
  return lookPose(0)
}

/** Entra e sai suave: 0 nas pontas do número, 1 no meio. */
const settleIn = (t: number, seconds: number) => smooth(0, 0.35, t) * (1 - smooth(seconds - 0.4, seconds, t))

/**
 * Pastando: dobra as patas da frente e estica o pescoço até a grama (quem inclina o corpo é o
 * `settle`, que mantém os quatro cascos no chão), belisca duas vezes e levanta a cabeça.
 */
export function grazePose(t: number, seconds: number): FawnPose {
  const down = settleIn(t, seconds)
  const pose = stand()
  pose.front = [mixLeg(leg(0, 0), leg(-0.24, 0.62), down), mixLeg(leg(0, 0), leg(-0.2, 0.56), down)]
  pose.neck = lerp(0.5, 1.46, down)
  pose.headPitch = lerp(0, 0.5, down) + 0.14 * (bump(t, 1.05, 0.45) + bump(t, 1.85, 0.45))
  pose.ears = [lerp(0.3, -0.25, down), lerp(0.3, -0.35, down)]
  pose.tail = 0.12 * bump(t, 1.5, 1.2)
  pose.tailWag = Math.sin(t * TAU * 2.6) * 0.3 * bump(t, 1.5, 1.4)
  pose.roll = 0.05 * Math.sin(t * 1.7) * down
  pose.squash = 1 + 0.01 * Math.sin(t * 4.2)
  return pose
}

/** Sacudida: sacode o corpo do pescoço pro rabo, orelhas batendo. Dura pouco, como o bicho. */
export function shakePose(t: number, seconds: number): FawnPose {
  const force = settleIn(t, seconds) * (1 - smooth(1.0, 1.35, t))
  const pose = stand()
  const wave = (delay: number) => Math.sin((t - delay) * TAU * 7.5)
  pose.roll = 0.3 * force * wave(0)
  pose.headRoll = 0.34 * force * wave(0.04)
  pose.neck = 0.5 + 0.1 * force * wave(0.06)
  pose.tailWag = 1.1 * force * wave(0.12)
  pose.tail = 0.35 * force
  // a orelha é mais leve que o corpo: bate mais e um pouco depois
  pose.ears = [0.3 - 1.2 * force * Math.abs(wave(0.05)), 0.3 - 1.2 * force * Math.abs(wave(0.09))]
  pose.squash = 1 - 0.035 * force * Math.abs(wave(0.02))
  pose.blink = Math.min(1, force * 1.4)
  return pose
}

/** Pulinho: dois pulos curtos no lugar, de pernas duras — o "pronk" que filhote faz à toa. */
export function pronkPose(t: number, seconds: number): FawnPose {
  const first = bump(t, 0.5, 0.62)
  const second = bump(t, 1.05, 0.56)
  const air = Math.max(first, second * 0.86)
  // no fim ele já está parado: o que sobra de rabo e balanço vai sumindo
  const calm = 1 - smooth(seconds - 0.35, seconds, t)
  const pose = stand()
  pose.lift = 0.16 * air
  pose.grounded = 1 - smooth(0.12, 0.3, air)
  // pernas duras, quase retas: é esse esticão que faz o pulinho parecer de filhote
  const stiff = 0.5 * air
  pose.front = [leg(-0.1 * air, 0.14 * air), leg(-0.08 * air, 0.12 * air)]
  pose.hind = [leg(RIG.hindRest.upper * (1 - stiff), RIG.hindRest.lower * (1 - stiff)), leg(RIG.hindRest.upper * (1 - stiff), RIG.hindRest.lower * (1 - stiff))]
  pose.pitch = -0.1 * air
  pose.roll = 0.06 * Math.sin(t * 3.1) * Math.max(air, 0.25 * calm)
  pose.squash = 1 + 0.07 * air - 0.05 * (bump(t, 0.86, 0.16) + bump(t, 1.38, 0.16))
  pose.neck = 0.5 - 0.12 * air
  pose.ears = [0.3 + 0.7 * air, 0.3 + 0.6 * air]
  pose.tail = 0.3 * air
  pose.tailWag = 0.4 * Math.sin(t * TAU * 3) * calm
  return pose
}

export const STARTLE_SECONDS = 0.26

/** O susto (u de 0 a 1): orelhas duras, rabo sobe, agacha pra arrancar. */
export function startlePose(u: number, from: FawnPose = lookPose(LOOK_SECONDS)): FawnPose {
  const crouch = hopPose(0.02, 0)
  const k = smooth(0, 1, u)
  const pose = mixPose(from, crouch, 0.8 * k)
  pose.look = from.look * (1 - smooth(0.15, 0.9, u))
  pose.ears = [lerp(from.ears[0], 1.25, k), lerp(from.ears[1], 1.25, k)]
  pose.neck = lerp(from.neck, 0.3, bump(u, 0.35, 0.7)) + 0.25 * smooth(0.6, 1, u)
  pose.tail = k
  pose.headRoll = 0
  return pose
}

const frac = (x: number) => x - Math.floor(x)

/** Uma perna no galope: apoia empurrando pra trás, depois dobra e volta pra frente. */
function gallopLeg(cycle: number, hind: boolean): LegPose {
  const psi = frac(cycle)
  const STANCE = 0.38
  if (psi < STANCE) {
    const s = psi / STANCE
    return hind ? leg(lerp(0.05, 1.05, s), lerp(-0.75, -0.3, s)) : leg(lerp(-0.78, 0.55, s), 0.12)
  }
  const w = (psi - STANCE) / (1 - STANCE)
  const back = smooth(0, 1, w)
  const fold = Math.sin(Math.PI * w)
  return hind ? leg(lerp(1.05, 0.05, back), lerp(-0.3, -0.75, back) - 1.05 * fold) : leg(lerp(0.55, -0.78, back), 0.12 + 1.5 * fold)
}

/** Galope (`cycle` = passadas desde o começo): corpo baixo, pescoço esticado, rabo branco em pé. */
export function gallopPose(cycle: number): FawnPose {
  const pose = stand()
  pose.grounded = 0
  pose.hind = [gallopLeg(cycle, true), gallopLeg(cycle + 0.08, true)]
  pose.front = [gallopLeg(cycle + 0.45, false), gallopLeg(cycle + 0.55, false)]
  pose.pitch = 0.11 * Math.sin(TAU * cycle + 0.5)
  pose.lift = 0.045 * Math.max(0, Math.sin(TAU * cycle + 2.5))
  pose.neck = 0.92 + 0.06 * Math.sin(TAU * cycle)
  pose.headPitch = 0.08
  pose.ears = [-1, -1]
  pose.tail = 1
  pose.tailWag = 0.25 * Math.sin(TAU * cycle * 2)
  return pose
}

// ---------- linha do tempo ----------

/** Espera a cena abrir (e quem está vendo olhar pra ela) antes de ele aparecer. */
export const WAIT_SECONDS = 1.2
export const HOP_SECONDS = 0.5
const STRIDE_SECONDS = 0.3
const FLEE_SPEED = 2.5
const FLEE_RAMP = 0.2

export type FawnPhase = 'wait' | 'enter' | 'act' | 'look' | 'startle' | 'flee'

/** O que vai acontecer nesta aparição: qual número e a semente da variação dos pulos. */
export interface FawnShow {
  act: FawnAct
  seed: number
}

const DEFAULT_SHOW: FawnShow = { act: 'chegada', seed: 0 }

/** O último número mostrado, pra não repetir na vez seguinte. Vive só nesta aba. */
let lastAct: FawnAct | null = null

/**
 * Sorteia a aparição da vez, nunca repetindo o número anterior: o jardim abre várias vezes por
 * dia e a mesma cena duas vezes seguidas entrega o truque.
 */
export function nextShow(random: () => number = Math.random): FawnShow {
  const options = FAWN_ACTS.filter((a) => a !== lastAct)
  const act = options[Math.min(options.length - 1, Math.floor(random() * options.length))]
  lastAct = act
  return { act, seed: Math.floor(random() * 1e9) }
}

export interface FawnMoment {
  phase: FawnPhase
  pose: FawnPose
  /** entrada: 0 = onde ele aparece, 1 = onde ele para */
  travel: number
  /** entrada: 0 = virado pro caminho, 1 = já virado pra pose de parar */
  turn: number
  /** tamanho (ele "brota" no primeiro instante) */
  scale: number
  /** susto: 0 a 1 */
  startle: number
  /** fuga: distância já corrida */
  fled: number
}

/** Quanto tempo a entrada inteira leva (cada pulo tem a sua duração). */
export function enterSeconds(hops: number, seed = 0): number {
  return hopShapes(hops, seed).reduce((sum, hop) => sum + hop.seconds, 0)
}

/** O que o cervinho está fazendo `t` segundos depois de a cena abrir. */
export function fawnMoment(t: number, hops: number, show: FawnShow = DEFAULT_SHOW): FawnMoment {
  const base = { travel: 1, turn: 1, scale: 1, startle: 0, fled: 0 }
  let tau = t - WAIT_SECONDS
  if (tau < 0) return { ...base, phase: 'wait', pose: hopPose(0, 0), travel: 0, turn: 0, scale: 0 }

  const shapes = hopShapes(hops, show.seed)
  const enter = shapes.reduce((sum, hop) => sum + hop.seconds, 0)
  if (tau < enter) {
    // acha em qual pulo ele está (as durações são diferentes) e quanto já andou dele
    let i = 0
    let start = 0
    while (i < hops - 1 && start + shapes[i].seconds <= tau) start += shapes[i++].seconds
    const hop = shapes[i]
    const u = clamp((tau - start) / hop.seconds, 0, 1)
    const last = i === hops - 1
    // aparece passando um pouco do tamanho e volta
    const k = Math.min(1, tau / 0.3)
    const pop = 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2
    return {
      ...base,
      phase: 'enter',
      pose: hopPose(u, hop.height, hop.roll),
      travel: (i + hopAdvance(u)) / hops,
      turn: last ? smooth(0.15, 0.9, u) : 0,
      scale: pop,
    }
  }
  tau -= enter

  const act = actSeconds(show.act)
  if (tau < act) return { ...base, phase: 'act', pose: actPose(show.act, tau) }
  tau -= act

  // o olhar emenda na pose em que o número terminou, pra cabeça não dar um pulo
  const after = act > 0 ? actPose(show.act, act) : hopPose(1, 0)
  const look = lookSeconds(show.act)
  if (tau < look) return { ...base, phase: 'look', pose: lookPose(tau, after) }
  tau -= look

  const looking = lookPose(look, after)
  if (tau < STARTLE_SECONDS) {
    const u = tau / STARTLE_SECONDS
    return { ...base, phase: 'startle', pose: startlePose(u, looking), startle: u }
  }
  tau -= STARTLE_SECONDS
  // arranca: a velocidade sobe em FLEE_RAMP segundos e depois fica constante
  const fled = tau < FLEE_RAMP ? (FLEE_SPEED * tau * tau) / (2 * FLEE_RAMP) : FLEE_SPEED * (tau - FLEE_RAMP / 2)
  const gallop = gallopPose(0.3 + tau / STRIDE_SECONDS)
  return { ...base, phase: 'flee', pose: mixPose(startlePose(1, looking), gallop, smooth(0, 0.14, tau)), startle: 1, fled }
}

// ---------- por onde ele anda ----------

export interface FawnPlan {
  /** onde ele aparece e onde ele para pra olhar */
  start: Vec2
  stop: Vec2
  hops: number
  /** pra onde o corpo aponta na entrada e na parada (0 = +z, cresce pro +x) */
  enterHeading: number
  stopHeading: number
  /** direção (no chão) da árvore pra câmera usada no plano */
  toCamera: Vec2
  /** o número desta aparição e a semente da variação dos pulos */
  show: FawnShow
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z)

/** Distância do ponto `p` ao segmento a-b. */
function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const k = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1)
  return Math.hypot(p.x - (a.x + dx * k), p.z - (a.z + dz * k))
}

/**
 * Escolhe o palco: ele para ao lado da árvore (do lado com mais espaço, sem nada na frente
 * tapando a visão da câmera) e chega pulando de mais longe, do mesmo lado.
 * `toCamera` = direção unitária, no chão, da árvore pra câmera. `obstacles` = plantas e placa.
 * `show` = qual número ele vai fazer; sem isso, sorteia um (sem repetir o da vez passada).
 */
export function planFawn(tree: Vec2, toCamera: Vec2, radius: number, obstacles: Vec2[], show: FawnShow = nextShow()): FawnPlan {
  const right = { x: toCamera.z, z: -toCamera.x }
  const at = (a: number, b: number): Vec2 => ({ x: tree.x + right.x * a + toCamera.x * b, z: tree.z + right.z * a + toCamera.z * b })

  let best = { stop: at(0.95, 0.45), side: 1, score: -Infinity }
  for (const side of [1, -1]) {
    for (const a of [0.95, 1.1, 0.8, 1.25]) {
      for (const b of [0.45, 0.25, 0.7]) {
        const stop = at(side * a, b)
        const inside = Math.hypot(stop.x, stop.z) / radius
        if (inside > 0.8) continue
        const sight = { x: stop.x + toCamera.x * 5, z: stop.z + toCamera.z * 5 }
        const near = obstacles.reduce((min, o) => Math.min(min, dist(o, stop)), 9)
        const view = obstacles.reduce((min, o) => Math.min(min, segmentDistance(o, stop, sight)), 9)
        const score = Math.min(near, 0.7) + Math.min(view, 0.5) - 0.15 * Math.abs(a - 0.95) - 0.1 * Math.abs(b - 0.45) - 0.2 * inside
        if (score > best.score) best = { stop, side, score }
      }
    }
  }
  const { stop, side } = best

  // de onde ele vem: de mais longe, pelo mesmo lado, pelo caminho mais livre
  const base = Math.atan2(right.x * side, right.z * side)
  let entry = { start: stop, length: 0, score: -Infinity }
  for (const turn of [0, 0.3, -0.3, 0.6, -0.6]) {
    const dir = { x: Math.sin(base + turn), z: Math.cos(base + turn) }
    // até onde dá pra ir nessa direção sem sair da ilha
    let length = 2.1
    while (length > 0.6 && Math.hypot(stop.x + dir.x * length, stop.z + dir.z * length) > radius * 0.88) length -= 0.1
    const start = { x: stop.x + dir.x * length, z: stop.z + dir.z * length }
    const clear = [tree, ...obstacles].reduce((min, o) => Math.min(min, segmentDistance(o, start, stop)), 9)
    const score = Math.min(clear, 0.45) + length * 0.3 - Math.abs(turn) * 0.1
    if (score > entry.score) entry = { start, length, score }
  }

  const enterHeading = Math.atan2(stop.x - entry.start.x, stop.z - entry.start.z)
  // para de lado pra câmera, um pouco virado pra ela (três quartos)
  const stopHeading = enterHeading + clamp(wrapAngle(Math.atan2(toCamera.x, toCamera.z) - enterHeading), -0.4, 0.4)
  return {
    start: entry.start,
    stop,
    hops: clamp(Math.round(entry.length / 0.5), 2, 5),
    enterHeading,
    stopHeading,
    toCamera,
    show,
  }
}

/** Ângulo entre -π e π. */
export function wrapAngle(angle: number): number {
  return angle - TAU * Math.round(angle / TAU)
}

/** Vai de um ângulo a outro pelo caminho mais curto. */
export function lerpAngle(from: number, to: number, k: number): number {
  return from + wrapAngle(to - from) * k
}

/** Quanto o cervinho (em tamanho 1) precisa passar da linha do tronco pra estar todo escondido. */
export const HIDDEN_PAST = 0.3

export interface FleePath {
  /** lado em que ele está quando arranca (+1 ou -1, no eixo "a") */
  side: number
  length: number
  /** ponto do caminho depois de correr `distance`: posição (a, b) e direção (da, db) */
  at: (distance: number) => { a: number; b: number; da: number; db: number; done: boolean }
}

/**
 * Caminho da fuga, em coordenadas relativas à câmera com a árvore na origem: "a" cresce pro
 * lado, "b" cresce em direção à câmera. Sai de (a0, b0), dá a volta por trás do tronco e
 * termina do outro lado (onde ele já não é desenhado).
 */
export function fleePath(a0: number, b0: number): FleePath {
  const side = a0 >= 0 ? 1 : -1
  const p0 = { a: a0, b: b0 }
  // o ponto de controle fica bem atrás: mesmo saindo da frente da árvore, a curva dá a volta
  // e cruza a linha do tronco longe dele (o tronco alarga na base)
  const c = { a: side * Math.max(0.6, Math.abs(a0) * 0.65), b: -0.68 }
  const p1 = { a: -side * 0.8, b: -0.46 }
  const point = (t: number) => {
    const u = 1 - t
    return {
      a: u * u * p0.a + 2 * u * t * c.a + t * t * p1.a,
      b: u * u * p0.b + 2 * u * t * c.b + t * t * p1.b,
      da: 2 * u * (c.a - p0.a) + 2 * t * (p1.a - c.a),
      db: 2 * u * (c.b - p0.b) + 2 * t * (p1.b - c.b),
    }
  }
  // tabela de comprimento: a curva não anda na mesma velocidade que o parâmetro t
  const STEPS = 32
  const lengths = [0]
  let previous = point(0)
  for (let i = 1; i <= STEPS; i++) {
    const p = point(i / STEPS)
    lengths.push(lengths[i - 1] + Math.hypot(p.a - previous.a, p.b - previous.b))
    previous = p
  }
  const length = lengths[STEPS]
  return {
    side,
    length,
    at: (distance) => {
      const d = clamp(distance, 0, length)
      let i = 1
      while (i < STEPS && lengths[i] < d) i++
      const span = lengths[i] - lengths[i - 1] || 1
      const t = (i - 1 + (d - lengths[i - 1]) / span) / STEPS
      return { ...point(t), done: distance >= length }
    },
  }
}
