// Mais efeitos de amigos na cena (só enfeite, nada mexe nas plantas):
// - HeartFountain: corações saindo da ilha do amigo AO VIVO, enquanto você toca/segura o botão;
// - Fireworks: fogos de artifício facetados, quando alguém aplaude uma conquista sua;
// - SeedCall: uma sementinha cai na ilha, quica e solta folhinhas (alguém te chamou pra focar).
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Color,
  DynamicDrawUsage,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  Vector3,
} from 'three'
import { createFacetMaterial } from './facetMaterial'
import { heartGeometry } from './heart'
import { rng } from './random'

const TAU = Math.PI * 2
const HIDDEN = new Matrix4().makeScale(0, 0, 0)

/** Esconde todas as instâncias (antes do primeiro quadro, todas estão na origem com escala 1). */
function useHiddenInstances(ref: RefObject<InstancedMesh | null>, count: number) {
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, HIDDEN)
    mesh.instanceMatrix.needsUpdate = true
  }, [ref, count])
}

// ---------- corações ao vivo ----------

const POOL = 220
const HEART_LIFE = 2.4

interface LiveHeart {
  age: number
  base: Vector3
  rise: number
  spin: number
  size: number
  phase: number
}

/**
 * `total` = quantos corações já saíram nesta visita. Quando aumenta, a diferença entra numa
 * fila e sai aos poucos (no máximo uns por quadro, e no máximo POOL na tela): mandar 500 de
 * uma vez vira um jorro contínuo em vez de travar.
 */
export function HeartFountain({ total, radius }: { total: number; radius: number }) {
  const geometry = useMemo(() => heartGeometry(), [])
  const material = useMemo(() => createFacetMaterial({ edge: 0.6, rim: 0.4, roughness: 0.45 }), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  const ref = useRef<InstancedMesh>(null)
  useHiddenInstances(ref, POOL)
  const invalidate = useThree((s) => s.invalidate)
  const state = useRef({ seen: total, queue: 0, slots: [] as (LiveHeart | null)[], random: rng(17) })
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), e: new Euler(), p: new Vector3(), s: new Vector3() }), [])

  useEffect(() => {
    const st = state.current
    if (total > st.seen) st.queue = Math.min(st.queue + (total - st.seen), POOL * 2)
    st.seen = total
    invalidate()
  }, [total, invalidate])

  useFrame((_, delta) => {
    const mesh = ref.current
    const st = state.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05)
    // quanto maior a fila, mais saem por quadro (o jorro acompanha a pressa de quem manda)
    let spawn = Math.min(st.queue, 1 + Math.floor(st.queue / 12))
    let busy = false
    for (let i = 0; i < POOL; i++) {
      let h = st.slots[i]
      if (!h && spawn > 0) {
        const r = radius * 0.45 * Math.sqrt(st.random())
        const a = st.random() * TAU
        h = {
          age: 0,
          base: new Vector3(Math.cos(a) * r, 0.4 + st.random() * 0.4, Math.sin(a) * r),
          rise: 0.8 + st.random() * 0.7,
          spin: (st.random() - 0.5) * 4,
          size: 0.17 + st.random() * 0.13,
          phase: st.random() * TAU,
        }
        st.slots[i] = h
        spawn -= 1
        st.queue -= 1
      }
      if (!h) continue
      busy = true
      h.age += dt
      const k = h.age / HEART_LIFE
      if (k >= 1) {
        st.slots[i] = null
        mesh.setMatrixAt(i, HIDDEN)
        continue
      }
      const pop = Math.min(1, k / 0.12)
      const grow = 1 + 2.2 * (pop - 1) ** 3 + 1.2 * (pop - 1) ** 2
      const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1
      tmp.p.set(h.base.x + Math.sin(h.age * 2 + h.phase) * 0.15, h.base.y + h.age * h.rise, h.base.z + Math.cos(h.age * 1.7 + h.phase) * 0.12)
      tmp.e.set(0, h.phase + h.age * h.spin, Math.sin(h.age * 3 + h.phase) * 0.25)
      tmp.s.setScalar(h.size * grow * fade)
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q.setFromEuler(tmp.e), tmp.s))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (busy || st.queue > 0) invalidate()
  })

  return <instancedMesh ref={ref} args={[geometry, material, POOL]} frustumCulled={false} name="heart-fountain" />
}

// ---------- fogos de artifício (aplausos) ----------

const SPARKS_PER_BURST = 44
const FIREWORK_COLORS = ['#a3402c', '#e2a93a', '#337a4e', '#f2c14e', '#f08fb0', '#fff6e2']

interface Spark {
  start: number
  origin: Vector3
  dir: Vector3
  speed: number
  color: Color
}

/** `count` aplausos = até 5 explosões, uma depois da outra, em cima da ilha. */
export function Fireworks({ count, radius, delay = 0 }: { count: number; radius: number; delay?: number }) {
  const bursts = Math.min(5, Math.max(1, count))
  const total = bursts * SPARKS_PER_BURST
  const geometry = useMemo(() => new OctahedronGeometry(0.05, 0), [])
  const material = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  const sparks = useMemo<Spark[]>(() => {
    const random = rng(count * 31 + 7)
    const list: Spark[] = []
    for (let b = 0; b < bursts; b++) {
      const a = random() * TAU
      const r = radius * 0.4 * random()
      const origin = new Vector3(Math.cos(a) * r, 2 + random() * 0.8, Math.sin(a) * r)
      const color = new Color(FIREWORK_COLORS[b % FIREWORK_COLORS.length])
      for (let i = 0; i < SPARKS_PER_BURST; i++) {
        // direções espalhadas numa esfera (espiral de Fibonacci), velocidade com um pouco de sorte
        const y = 1 - ((i + 0.5) / SPARKS_PER_BURST) * 2
        const rr = Math.sqrt(1 - y * y)
        const t = i * 2.399963
        list.push({
          start: delay + b * 0.55,
          origin,
          dir: new Vector3(Math.cos(t) * rr, y, Math.sin(t) * rr),
          speed: 1.3 + random() * 0.6,
          color: color.clone().lerp(new Color('#ffffff'), random() * 0.35),
        })
      }
    }
    return list
  }, [count, bursts, radius, delay])

  const ref = useRef<InstancedMesh>(null)
  useHiddenInstances(ref, total)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    sparks.forEach((s, i) => mesh.setColorAt(i, s.color))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [sparks])
  const age = useRef(0)
  const invalidate = useThree((s) => s.invalidate)
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3() }), [])
  const end = delay + bursts * 0.55 + 2.2

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh || age.current < 0) return
    age.current += Math.min(delta, 0.05)
    const t = age.current
    if (t > end) {
      age.current = -1
      mesh.visible = false
      return
    }
    sparks.forEach((s, i) => {
      const k = (t - s.start) / 1.8
      if (k <= 0 || k >= 1) {
        mesh.setMatrixAt(i, HIDDEN)
        return
      }
      const travel = (1 - (1 - k) ** 3) * s.speed // abre rápido e freia
      tmp.p.copy(s.origin).addScaledVector(s.dir, travel)
      tmp.p.y -= k * k * 0.9 // gravidade
      tmp.s.setScalar(1.4 * (1 - k))
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q.identity(), tmp.s))
    })
    mesh.instanceMatrix.needsUpdate = true
    invalidate()
  })

  return <instancedMesh ref={ref} args={[geometry, material, total]} frustumCulled={false} name="fireworks" />
}

// ---------- sementinha (chamar pra focar) ----------

const SEED_LEAVES = 14

/** A semente cai do céu no meio da ilha, quica e solta um punhado de folhinhas. */
export function SeedCall({ delay = 0 }: { delay?: number }) {
  const seed = useMemo(() => new IcosahedronGeometry(0.11, 0), [])
  const leaf = useMemo(() => new OctahedronGeometry(0.06, 0), [])
  const seedMaterial = useMemo(() => new MeshStandardMaterial({ color: '#b88752', flatShading: true, roughness: 0.55 }), [])
  const leafMaterial = useMemo(() => new MeshBasicMaterial({ color: '#7fb85a', toneMapped: false }), [])
  useEffect(
    () => () => {
      seed.dispose()
      leaf.dispose()
      seedMaterial.dispose()
      leafMaterial.dispose()
    },
    [seed, leaf, seedMaterial, leafMaterial],
  )
  const seedRef = useRef<Mesh>(null)
  const leaves = useRef<InstancedMesh>(null)
  useHiddenInstances(leaves, SEED_LEAVES)
  const dirs = useMemo(() => {
    const random = rng(23)
    return Array.from({ length: SEED_LEAVES }, (_, i) => {
      const a = (i / SEED_LEAVES) * TAU + random() * 0.3
      return new Vector3(Math.cos(a), 1.2 + random() * 0.8, Math.sin(a)).multiplyScalar(0.6 + random() * 0.4)
    })
  }, [])
  const age = useRef(0)
  const invalidate = useThree((s) => s.invalidate)
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), e: new Euler(), p: new Vector3(), s: new Vector3() }), [])

  useFrame((_, delta) => {
    const mesh = seedRef.current
    const leafMesh = leaves.current
    if (!mesh || !leafMesh || age.current < 0) return
    age.current += Math.min(delta, 0.05)
    const t = age.current - delay
    if (t > 3.6) {
      age.current = -1
      mesh.visible = false
      leafMesh.visible = false
      return
    }
    // cai (aceleração), quica duas vezes e encolhe no fim
    const fall = Math.min(1, Math.max(0, t) / 0.9)
    let y = 3 * (1 - fall * fall)
    if (t > 0.9) y = Math.abs(Math.sin((t - 0.9) * 5)) * 0.35 * Math.exp(-(t - 0.9) * 2.5)
    mesh.position.set(0, 0.15 + y, 0)
    mesh.rotation.set(t * 2, t * 3, 0)
    mesh.scale.setScalar(t < 0 ? 0 : t > 3 ? 1 - (t - 3) / 0.6 : 1)
    // as folhinhas saem no primeiro toque no chão
    dirs.forEach((d, i) => {
      const k = (t - 0.9) / 1.6
      if (k <= 0 || k >= 1) {
        leafMesh.setMatrixAt(i, HIDDEN)
        return
      }
      tmp.p.set(d.x * k * 1.2, 0.2 + d.y * k - k * k * 1.2, d.z * k * 1.2)
      tmp.e.set(k * 6 + i, k * 4, 0)
      tmp.s.setScalar(1.3 * (1 - k))
      leafMesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q.setFromEuler(tmp.e), tmp.s))
    })
    leafMesh.instanceMatrix.needsUpdate = true
    invalidate()
  })

  return (
    <group name="seed-call">
      <mesh ref={seedRef} geometry={seed} material={seedMaterial} scale={0} castShadow />
      <instancedMesh ref={leaves} args={[leaf, leafMaterial, SEED_LEAVES]} frustumCulled={false} />
    </group>
  )
}
