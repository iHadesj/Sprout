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
  /** abre a perna pro lado, girando no quadril: positivo leva o casco pro +x (o lado da perna esquerda) */
  out?: number
}

export interface FawnPose {
  /** altura do casco mais baixo acima do chão (só vale com as patas no ar) */
  lift: number
  /** inclinação do corpo: positivo = focinho pra baixo */
  pitch: number
  /** tombo lateral do tronco: o peso caindo pra um lado no pulo, e a sacudida */
  roll: number
  /**
   * Quanto cada par de patas está apoiado [frente, trás]: 1 = cascos plantados no chão,
   * 0 = no ar. Com um par só apoiado, o corpo gira em volta dele (é o que deixa a pata de trás
   * empurrar o chão no pulo, em vez de o bicho inteiro levitar).
   */
  contact: [number, number]
  /** achatar/esticar o corpo (1 = normal) */
  squash: number
  /** pernas [esquerda, direita] */
  front: [LegPose, LegPose]
  hind: [LegPose, LegPose]
  /** pescoço: 0 = em pé, maior = dobrado pra frente e pra baixo (dividido entre as duas juntas) */
  neck: number
  /** pescoço pro lado (radianos): o balanço da sacudida, o mexer de quem belisca a grama */
  sway: number
  headPitch: number
  /** cabeça de ladinho (curiosidade), ou girando em volta do focinho (sacudida) */
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
  /**
   * Pescoço em dois gomos: a base sai de dentro do peito e o de cima leva a cabeça. Cada junta
   * é o centro de uma esfera da geometria, então girar nunca abre buraco. `split` = quanto da
   * dobra fica na base (o pescoço de bicho dobra mais lá embaixo, perto do ombro).
   */
  neck: { y: 0.25, z: 0.118, base: 0.068, top: 0.07, split: 0.6 },
  tail: { y: 0.272, z: -0.166 },
}

type Pair = 'front' | 'hind'
type V3 = [number, number, number]

// as mesmas rotações do three (rotation.x e rotation.z), escritas à mão pra não depender dele
const rotX = ([x, y, z]: V3, a: number): V3 => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)]
const rotZ = ([x, y, z]: V3, a: number): V3 => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z]

/**
 * Altura do casco (0 = chão com o corpo parado) pra uma perna, com o tronco inclinado `pitch` e
 * tombado `roll`. `side` = +1 pra perna esquerda (+x), -1 pra direita. É a mesma conta que o
 * three faz com os grupos do Fawn.tsx: canela dentro da coxa, coxa dentro do tronco.
 */
export function footY(pair: Pair, leg: LegPose, pitch: number, roll = 0, side = 1): number {
  const j = RIG[pair]
  const knee = rotX([0, -j.lower, 0], leg.lower)
  let v = rotX(rotZ([0, knee[1] - j.upper, knee[2]], leg.out ?? 0), leg.upper)
  v = [v[0] + side * j.x, v[1] + j.y - RIG.pivotY, v[2] + j.z]
  v = rotX(rotZ(v, roll), pitch)
  return RIG.pivotY + v[1]
}

const lowest = (pair: Pair, legs: [LegPose, LegPose], pitch: number, roll: number) =>
  Math.min(footY(pair, legs[0], pitch, roll, 1), footY(pair, legs[1], pitch, roll, -1))

/** O casco mais baixo de todos, pra uma inclinação. */
const lowestFoot = (pose: FawnPose, pitch: number) => Math.min(lowest('front', pose.front, pitch, pose.roll), lowest('hind', pose.hind, pitch, pose.roll))

/**
 * Onde o corpo fica: a inclinação e a altura do meio do tronco.
 * - Os dois pares apoiados: a inclinação é a que faz as patas da frente e de trás tocarem juntas.
 * - Um par só: esse par fica no chão e o corpo gira em volta dele (empurrar, pousar).
 * - No ar: o casco mais baixo fica `lift` acima do chão.
 * Em qualquer caso, nenhum casco afunda no chão.
 */
export function settle(pose: FawnPose): { pitch: number; y: number } {
  const [front, hind] = pose.contact
  let pitch = pose.pitch
  const both = Math.min(front, hind)
  if (both > 0) {
    // método da secante: acha a inclinação em que os dois pares de patas ficam na mesma altura
    const gap = (p: number) => lowest('front', pose.front, p, pose.roll) - lowest('hind', pose.hind, p, pose.roll)
    let p0 = 0
    let p1 = 0.05
    for (let i = 0; i < 8; i++) {
      const g0 = gap(p0)
      const g1 = gap(p1)
      if (Math.abs(g1 - g0) < 1e-9) break
      const next = clamp(p1 - (g1 * (p1 - p0)) / (g1 - g0), -0.7, 0.7)
      p0 = p1
      p1 = next
    }
    pitch = lerp(pose.pitch, p1, both)
  }
  const lowFront = lowest('front', pose.front, pitch, pose.roll)
  const lowHind = lowest('hind', pose.hind, pitch, pose.roll)
  const low = Math.min(lowFront, lowHind)
  let y = pose.lift - low
  if (front + hind > 1e-6) {
    const planted = (front * -lowFront + hind * -lowHind) / (front + hind)
    y = lerp(y, planted, Math.max(front, hind))
  }
  return { pitch, y: Math.max(y, -low) }
}

// ---------- poses ----------

const leg = (upper: number, lower: number, out = 0): LegPose => ({ upper, lower, out })

function stand(): FawnPose {
  const h = RIG.hindRest
  return {
    lift: 0,
    roll: 0,
    pitch: 0,
    contact: [1, 1],
    squash: 1,
    front: [leg(0, 0), leg(0, 0)],
    hind: [leg(h.upper, h.lower), leg(h.upper, h.lower)],
    neck: 0.5,
    sway: 0,
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
  return leg(lerp(a.upper, b.upper, k), lerp(a.lower, b.lower, k), lerp(a.out ?? 0, b.out ?? 0, k))
}

/** Mistura de duas poses (0 = a, 1 = b). */
export function mixPose(a: FawnPose, b: FawnPose, k: number): FawnPose {
  const n = (key: 'lift' | 'pitch' | 'roll' | 'squash' | 'neck' | 'sway' | 'headPitch' | 'headRoll' | 'look' | 'tail' | 'tailWag' | 'blink') => lerp(a[key], b[key], k)
  return {
    lift: n('lift'),
    roll: n('roll'),
    pitch: n('pitch'),
    contact: [lerp(a.contact[0], b.contact[0], k), lerp(a.contact[1], b.contact[1], k)],
    squash: n('squash'),
    front: [mixLeg(a.front[0], b.front[0], k), mixLeg(a.front[1], b.front[1], k)],
    hind: [mixLeg(a.hind[0], b.hind[0], k), mixLeg(a.hind[1], b.hind[1], k)],
    neck: n('neck'),
    sway: n('sway'),
    headPitch: n('headPitch'),
    headRoll: n('headRoll'),
    look: n('look'),
    ears: [lerp(a.ears[0], b.ears[0], k), lerp(a.ears[1], b.ears[1], k)],
    tail: n('tail'),
    tailWag: n('tailWag'),
    blink: n('blink'),
  }
}

/**
 * Quadros-chave [tempo, ...valores] ligados por uma curva que passa por todos eles sem parar
 * em nenhum (Catmull-Rom: a velocidade em cada quadro vem dos vizinhos). Com o smoothstep de
 * antes, cada quadro-chave freava até zero e arrancava de novo: era isso que deixava o pulo
 * com cara de stop-motion. `loop` = a tabela é um ciclo (a última linha repete a primeira em t=1).
 */
function curve(table: number[][], u: number, loop = false): number[] {
  const last = table.length - 1
  let i = 0
  while (i < last - 1 && u > table[i + 1][0]) i++
  const a = table[i]
  const b = table[i + 1]
  // vizinhos de fora da tabela: num ciclo, vêm do outro lado (com o tempo deslocado de 1)
  const prev = i > 0 ? table[i - 1] : loop ? [table[last - 1][0] - 1, ...table[last - 1].slice(1)] : null
  const next = i + 2 <= last ? table[i + 2] : loop ? [table[1][0] + 1, ...table[1].slice(1)] : null
  const span = b[0] - a[0]
  const s = clamp((u - a[0]) / span, 0, 1)
  const s2 = s * s
  const s3 = s2 * s
  return a.slice(1).map((_, n) => {
    const c = n + 1
    // nas pontas de uma tabela que não é ciclo, a curva chega parada (o bicho começa e termina quieto)
    const m0 = prev ? ((b[c] - prev[c]) / (b[0] - prev[0])) * span : 0
    const m1 = next ? ((next[c] - a[c]) / (next[0] - a[0])) * span : 0
    return (2 * s3 - 3 * s2 + 1) * a[c] + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b[c] + (s3 - s2) * m1
  })
}

/** Sobe de 0 a 1 e volta, em volta de `center` (largura total `width`). */
const bump = (t: number, center: number, width: number) => {
  const x = 1 - Math.abs((t - center) / (width / 2))
  return x <= 0 ? 0 : x * x * (3 - 2 * x)
}

/**
 * O mesmo bump, mas dando a volta no ciclo (u de 0 a 1 é circular). É o que o pouso precisa:
 * o tranco acontece no fim do pulo e o corpo ainda está voltando no começo do pulo seguinte.
 */
const cycleBump = (u: number, center: number, width: number) => {
  const away = Math.abs((((u - center + 1.5) % 1) + 1) % 1 - 0.5)
  const x = 1 - away / (width / 2)
  return x <= 0 ? 0 : x * x * (3 - 2 * x)
}

/** Curva de Hermite: vai de `a` (velocidade `ma`) a `b` (velocidade `mb`), com s de 0 a 1. */
function hermite(a: number, b: number, ma: number, mb: number, s: number): number {
  const s2 = s * s
  const s3 = s2 * s
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * ma + (-2 * s3 + 3 * s2) * b + (s3 - s2) * mb
}

/** Quanto antes de largar o chão o voo já começa a puxar o corpo (mesma unidade de `from`/`to`). */
const PUSH = 0.06

/**
 * O voo: o corpo sai do chão com a velocidade que o empurrão deu, sobe `height` acima do mais
 * alto entre decolar e pousar, e desce freando (as patas esticadas amortecem o pouso). As pernas
 * fazem o que a pose manda; só a altura do corpo segue essa curva.
 *
 * Por que não uma parábola pura: a perna de trás, girando pra trás no fim do empurrão, perde
 * alcance, então o corpo vinha quase parado e de repente arrancava na velocidade da parábola.
 * Era um quique bem no instante de sair do chão. Aqui a curva começa um tico antes (`PUSH`),
 * com a velocidade que o corpo já tinha, e não quebra.
 */
function airborne(pose: FawnPose, u: number, frame: (u: number) => FawnPose, from: number, to: number, height: number): FawnPose {
  const start = from - PUSH
  if (u <= start || u >= to || height <= 0) return pose
  const yAt = (x: number) => settle(frame(x)).y
  const y0 = yAt(start)
  const v0 = (y0 - yAt(start - 0.01)) / 0.01
  const y1 = yAt(to)
  const mid = lerp(from, to, 0.5)
  const top = Math.max(yAt(from), y1) + height
  // chegando: 45% da velocidade de uma parábola, pra pousar macio
  const v1 = (-0.45 * 2 * (top - y1)) / (to - mid)
  const body = u < mid ? hermite(y0, top, v0 * (mid - start), 0, (u - start) / (mid - start)) : hermite(top, y1, 0, v1 * (to - mid), (u - mid) / (to - mid))
  // no ar ninguém está apoiado: guarda a inclinação de agora e converte a altura do corpo na do
  // casco mais baixo (é o que o settle sabe ler)
  pose.pitch = settle(pose).pitch
  pose.contact = [0, 0]
  pose.lift = Math.max(0, body + lowestFoot(pose, pose.pitch))
  return pose
}

// O pulo de filhote (o "bound" de cervo), olhando bicho de verdade:
// 1. agachado, as patas de trás embaixo da barriga;
// 2. as da frente saem primeiro, dobrando o joelho; as de trás ficam plantadas e esticam,
//    empurrando o corpo pra cima e pra frente (focinho sobe);
// 3. no ar: logo depois de sair, as de trás ainda esticadas pra trás e as da frente se
//    abrindo pra frente; no alto, as de trás já vêm dobrando pra baixo do corpo;
// 4. pousa com as da FRENTE (focinho desce) e o corpo passa por cima delas;
// 5. as de trás descem embaixo da barriga e ele já está agachado pro próximo.
// colunas: tempo | frente (coxa, canela) | trás (coxa, canela) | inclinação | pescoço | orelhas | rabo | achatar
const HOP = [
  [0.0, 0.26, 0.42, 0.2, -0.86, 0.0, 0.62, 0.3, 0.15, 0.97], // agachado, patas de trás embaixo da barriga
  [0.1, -0.3, 1.15, 0.48, -0.74, -0.14, 0.54, 0.1, 0.3, 1.0], // as da frente saem, as de trás esticando
  [0.2, -0.55, 1.5, 0.9, -0.2, -0.2, 0.44, -0.2, 0.5, 1.02], // as de trás saem do chão, esticadas
  [0.33, -0.82, 1.05, 0.98, -0.62, -0.12, 0.44, -0.35, 0.62, 1.01], // no ar, se abrindo
  [0.47, -0.86, 0.32, 0.55, -1.2, 0.05, 0.52, -0.25, 0.55, 1.0], // no alto: frente estica, trás recolhe
  [0.6, -0.36, 0.0, 0.3, -1.15, 0.14, 0.62, 0.1, 0.4, 0.99], // toca o chão com as da frente
  [0.72, 0.02, 0.55, 0.12, -1.0, 0.1, 0.66, 0.45, 0.3, 0.97], // passa por cima delas, as de trás vindo
  [0.85, 0.22, 0.38, 0.16, -0.86, 0.02, 0.64, 0.4, 0.2, 0.965], // as de trás tocam: agachado de novo
  [1.0, 0.26, 0.42, 0.2, -0.86, 0.0, 0.62, 0.3, 0.15, 0.97],
]
/** As patas de trás largam o chão aqui, e as da frente tocam aqui. Entre os dois: voo. */
const HOP_TAKEOFF = 0.2
const HOP_LAND = 0.6

/** O pulo sem o voo: a pose das pernas e quem está apoiado. */
function hopFrame(u: number, roll: number): FawnPose {
  const at = (x: number) => curve(HOP, ((x % 1) + 1) % 1, true)
  const [fu, fl, hu, hl, pitch, neck, ears, tail, squash] = at(u)
  // o lado direito vai um tiquinho atrasado: as patas não se mexem como um carimbo
  const [rfu, rfl, rhu, rhl] = at(u - 0.03)
  const pose = stand()
  pose.pitch = pitch
  pose.contact = [1 - smooth(0.015, 0.075, u) + smooth(HOP_LAND, HOP_LAND + 0.045, u), 1 - smooth(HOP_TAKEOFF - 0.05, HOP_TAKEOFF, u) + smooth(0.77, 0.86, u)]
  const air = clamp((u - HOP_TAKEOFF) / (HOP_LAND - HOP_TAKEOFF), 0, 1)
  pose.roll = roll * 4 * air * (1 - air)
  pose.squash = squash
  pose.front = [leg(fu, fl), leg(rfu, rfl)]
  pose.hind = [leg(hu, hl), leg(rhu, rhl)]
  // pouso: o pescoço dá um tranco pra baixo e as orelhas batem, um tiquinho depois das patas
  pose.neck = neck + 0.1 * cycleBump(u, 0.68, 0.22)
  const flop = 0.5 * cycleBump(u, 0.7, 0.2)
  pose.ears = [ears - flop, ears * 0.85 - flop * 1.2]
  pose.tail = tail
  return pose
}

/**
 * Um pulo (u de 0 a 1): agacha, empurra com as de trás, voa, pousa com as da frente. `height` =
 * quanto o corpo sobe além da linha entre decolar e pousar; `roll` = quanto o corpo tomba pro
 * lado no ar (o peso caindo, que tira o jeito de brinquedo de corda).
 */
export function hopPose(u: number, height: number, roll = 0): FawnPose {
  return airborne(hopFrame(u, roll), u, (x) => hopFrame(x, roll), HOP_TAKEOFF, HOP_LAND, height)
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
    const slow = 0.92 + random() * 0.2
    return {
      seconds: HOP_SECONDS * (last ? 1.1 : slow),
      height: last ? 0.06 + random() * 0.02 : 0.09 + random() * 0.04,
      roll: (i % 2 === 0 ? 1 : -1) * (0.04 + random() * 0.04),
    }
  })
}

/**
 * Quanto do pulo já andou pra frente (0 a 1). A velocidade sobe no empurrão, fica constante no
 * ar (no ar ninguém acelera) e cai depois do pouso, sem nunca zerar: o corpo vem embalado.
 */
const hopSpeed = (u: number) => 0.18 + 0.82 * smooth(0.02, HOP_TAKEOFF, u) - 0.82 * smooth(HOP_LAND, 0.9, u)
const HOP_ADVANCE = (() => {
  const steps = 200
  const table = [0]
  for (let i = 1; i <= steps; i++) table.push(table[i - 1] + hopSpeed((i - 0.5) / steps))
  return table.map((v) => v / table[steps])
})()
function hopAdvance(u: number): number {
  const x = clamp(u, 0, 1) * (HOP_ADVANCE.length - 1)
  const i = Math.min(HOP_ADVANCE.length - 2, Math.floor(x))
  return lerp(HOP_ADVANCE[i], HOP_ADVANCE[i + 1], x - i)
}

export const LOOK_SECONDS = 2.9

/**
 * Parado, olhando pra ela (t em segundos desde o pouso): orelha mexe, cabeça de lado, pisca,
 * rabinho. `from` = a pose em que ele estava (o fim do número que acabou), pra emendar sem pulo.
 */
export function lookPose(t: number, from: FawnPose = hopPose(1, 0)): FawnPose {
  const pose = mixPose(from, stand(), smooth(0, 0.5, t))
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
  pastando: { seconds: 3.2, look: 1.5 },
  sacudida: { seconds: 1.6, look: 1.8 },
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

/**
 * Pastando, como filhote faz: o pescoço dele não chega no chão com as pernas retas, então ele
 * abre as patas da frente pros lados (e o corpo desce na frente), dobra o pescoço lá na base e
 * aponta o focinho pra grama. Belisca, mastiga mexendo a cabeça, uma orelha vira pra trás
 * escutando e ele levanta a cabeça de uma vez, já atento.
 */
export function grazePose(t: number, seconds: number): FawnPose {
  const down = smooth(0.05, 0.85, t) * (1 - smooth(seconds - 0.55, seconds - 0.05, t))
  // o corpo arma um tiquinho antes do pescoço: primeiro as patas abrem, depois a cabeça desce
  const legs = smooth(0, 0.6, t) * (1 - smooth(seconds - 0.45, seconds, t))
  const pose = stand()
  const h = RIG.hindRest
  pose.front = [leg(-0.14 * legs, 0.16 * legs, 0.52 * legs), leg(-0.08 * legs, 0.12 * legs, -0.47 * legs)]
  pose.hind = [leg(h.upper + 0.05 * legs, h.lower - 0.08 * legs, 0.05 * legs), leg(h.upper + 0.05 * legs, h.lower - 0.08 * legs, -0.05 * legs)]
  // dois beliscões: a cabeça puxa a grama (sobe um tico e volta), entre eles a mastigação
  const tug = bump(t, 1.35, 0.32) + bump(t, 2.1, 0.32)
  pose.neck = lerp(0.5, 2.75, down) - 0.12 * tug * down
  pose.headPitch = lerp(0, 1.3, down) - 0.18 * tug * down
  pose.sway = 0.09 * Math.sin((t - 0.8) * 2.6) * smooth(0.8, 1.2, t) * down
  pose.headRoll = 0.06 * Math.sin((t - 0.8) * 5.2) * down
  // uma orelha mexe e vira pra trás (escutando) no meio da refeição
  pose.ears = [lerp(0.3, 0.05, down) + 0.5 * bump(t, 1.75, 0.25), lerp(0.3, -0.2, down) - 0.45 * bump(t, 2.4, 0.5)]
  pose.tail = 0.12 * bump(t, 1.7, 1.2)
  pose.tailWag = Math.sin(t * TAU * 2.6) * 0.3 * bump(t, 1.7, 1.4)
  pose.squash = 1 + 0.008 * Math.sin(t * 4.2)
  return pose
}

/**
 * Sacudida, do jeito que cachorro e cervo fazem: firma as patas, e a sacudida nasce na cabeça
 * (que gira em volta do focinho), passa pro tronco (que gira em volta da espinha) e termina no
 * rabo. Os cascos ficam plantados: as pernas compensam o giro do tronco no quadril. Antes o
 * tronco inteiro girava com as pernas penduradas e os cascos varriam o chão pros lados.
 */
export function shakePose(t: number, seconds: number): FawnPose {
  const HZ = 6
  const wave = (delay: number) => Math.sin((t - delay) * TAU * HZ)
  const window = (a: number, b: number, c: number, d: number) => smooth(a, b, t) * (1 - smooth(c, d, t))
  const brace = window(0, 0.25, seconds - 0.4, seconds - 0.05)
  const head = window(0.12, 0.3, 0.8, 1.05)
  const body = window(0.25, 0.45, 0.95, 1.2)
  const tail = window(0.4, 0.6, 1.1, 1.35)
  const pose = stand()
  const h = RIG.hindRest
  pose.roll = 0.1 * body * wave(0.06)
  // a perna gira o contrário do tronco (o casco fica onde estava) e abre um tico pra firmar
  const counter = -pose.roll * 0.92
  pose.front = [leg(0, 0, counter + 0.05 * brace), leg(0, 0, counter - 0.05 * brace)]
  pose.hind = [leg(h.upper, h.lower, counter + 0.05 * brace), leg(h.upper, h.lower, counter - 0.05 * brace)]
  pose.neck = 0.5 + 0.18 * brace
  pose.headPitch = 0.1 * brace
  pose.headRoll = 0.5 * head * wave(0)
  pose.sway = 0.12 * head * wave(0.02)
  // a orelha é mais leve que a cabeça: chicoteia atrasada
  pose.ears = [0.25 - 1.0 * head * Math.abs(wave(0.035)), 0.25 - 1.0 * head * Math.abs(wave(0.055))]
  pose.tail = 0.4 * tail
  pose.tailWag = 1.0 * tail * wave(0.14)
  pose.squash = 1 - 0.02 * brace
  // olho fechado enquanto a cabeça sacode, e uma piscada no fim
  pose.blink = Math.min(1, head * 1.3 + bump(t, 1.3, 0.16))
  return pose
}

// colunas: tempo (s) | frente (coxa, canela) | trás (coxa, canela) | pescoço | orelhas | rabo | achatar
const PRONK = [
  [0.0, 0, 0, 0.38, -0.46, 0.5, 0.3, 0, 1],
  [0.24, 0.06, 0.26, 0.2, -0.92, 0.62, 0.15, 0.2, 0.96], // agacha (as quatro dobram)
  [0.36, -0.04, 0.02, 0.32, -0.22, 0.42, 0.5, 0.45, 1.02], // estica as quatro de uma vez
  [0.5, -0.15, 0.1, 0.22, -0.32, 0.34, 0.95, 0.6, 1.01], // no ar de pernas duras, um tico pra baixo do corpo
  [0.63, -0.03, 0.03, 0.32, -0.24, 0.42, 0.75, 0.5, 1.0], // toca as quatro juntas
  [0.73, 0.07, 0.3, 0.18, -0.9, 0.6, -0.15, 0.3, 0.96], // amortece (orelhas batem)
  [0.85, -0.04, 0.02, 0.32, -0.22, 0.44, 0.45, 0.45, 1.02], // de novo, mais baixinho
  [0.96, -0.12, 0.08, 0.24, -0.3, 0.38, 0.85, 0.5, 1.01],
  [1.07, -0.03, 0.03, 0.32, -0.24, 0.44, 0.6, 0.4, 1.0],
  [1.17, 0.05, 0.24, 0.22, -0.82, 0.58, -0.05, 0.25, 0.97],
  [1.5, 0, 0, 0.38, -0.46, 0.5, 0.3, 0, 1],
]
const PRONK_AIR: [number, number, number][] = [
  [0.36, 0.63, 0.11],
  [0.85, 1.07, 0.08],
]

function pronkFrame(t: number): FawnPose {
  const [fu, fl, hu, hl, neck, ears, tail, squash] = curve(PRONK, t)
  const pose = stand()
  pose.front = [leg(fu, fl), leg(fu, fl)]
  pose.hind = [leg(hu, hl), leg(hu, hl)]
  const grounded = PRONK_AIR.reduce((c, [a, b]) => c - smooth(a - 0.03, a, t) + smooth(b, b + 0.03, t), 1)
  pose.contact = [grounded, grounded]
  pose.neck = neck
  pose.ears = [ears, ears * 0.9]
  pose.tail = tail
  pose.squash = squash
  return pose
}

/** Pulinho: dois pulos no lugar com as quatro patas juntas e duras — o "pronk" que filhote faz à toa. */
export function pronkPose(t: number, seconds: number): FawnPose {
  let pose = pronkFrame(t)
  for (const [a, b, height] of PRONK_AIR) pose = airborne(pose, t, pronkFrame, a, b, height)
  // o corpo balança um pouco de lado e o rabo abana, sumindo no fim
  const calm = 1 - smooth(seconds - 0.35, seconds, t)
  pose.roll = 0.04 * Math.sin(t * 3.1) * calm * smooth(0.2, 0.5, t)
  pose.tailWag = 0.4 * Math.sin(t * TAU * 3) * calm * smooth(0.3, 0.6, t)
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
  pose.sway = 0
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
  pose.contact = [0, 0]
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
  // o número começa do agachado em que o último pulo pousou, sem pular pra pose dele
  if (tau < act) return { ...base, phase: 'act', pose: mixPose(hopPose(1, 0), actPose(show.act, tau), smooth(0, 0.4, tau)) }
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
