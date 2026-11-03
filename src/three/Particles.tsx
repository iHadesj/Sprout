// O que flutua no ar, com uma física simples (por frame, sem biblioteca):
// - FallingLeaves: folhas que soltam da altura das copas e caem como folha de verdade: descem
//   devagar, balançam de um lado pro outro como pêndulo (inclinando pro lado em que vão), o
//   vento empurra de leve; pousam deitadas no chão, ficam um pouco e somem. Fazem sombra.
// - Snowfall (bioma neve): flocos caindo e balançando; ao tocar o chão, voltam lá pra cima.
// - PetalBurst: as pétalas que caem quando uma planta fica adulta.
// Tudo com instancing: uma chamada à GPU por tipo.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from 'three'
import type { IslandShape } from './islandGeometry'
import { MeshBuilder } from './meshBuilder'
import { rng } from './random'

const TAU = Math.PI * 2
/** vento: empurra tudo devagar pra um lado só */
const WIND = new Vector3(0.05, 0, 0.025)

function triangleGeometry(color: Color, width: number, length: number): BufferGeometry {
  const b = new MeshBuilder(rng(3), 0.1)
  b.triangle(new Vector3(-width, 0, 0), new Vector3(width, 0, 0), new Vector3(0, 0, length), color, color, color.clone().offsetHSL(0, 0, 0.1))
  return b.build()
}

/** Folha em losango com nervura (dois pares de triângulos, levemente dobrada no meio). Branca: a cor vem por instância. */
function leafGeometry(): BufferGeometry {
  const b = new MeshBuilder(rng(5), 0)
  const base = new Vector3(0, 0, -0.06)
  const tip = new Vector3(0, 0, 0.07)
  const left = new Vector3(-0.035, 0.008, 0)
  const right = new Vector3(0.035, 0.008, 0)
  const light = new Color('#ffffff')
  const shade = new Color('#c9c9c9')
  b.triangle(base, left, tip, shade, light, light)
  b.triangle(base, tip, right, shade, light, light)
  return b.build()
}

interface Leaf {
  p: Vector3
  /** fase e velocidade do balanço (pêndulo) */
  phase: number
  freq: number
  amp: number
  /** direção do balanço (no plano do chão) */
  dir: Vector3
  fall: number
  yaw: number
  spin: number
  /** 'falling' -> 'resting' (no chão) -> some e volta lá em cima */
  resting: number
  grow: number
}

/** Folhas caindo das copas. `colors`: tons de folha (mais um da cor do jardim, de vez em quando). */
export function FallingLeaves({ radius, heightAt, colors }: { radius: number; heightAt: IslandShape['heightAt']; colors: string[] }) {
  const count = 8
  const geometry = useMemo(() => leafGeometry(), [])
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide, roughness: 0.8 }), [])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => geometry.dispose(), [geometry])

  const random = useMemo(() => rng(99), [])
  const leaves = useMemo<Leaf[]>(() => {
    return Array.from({ length: count }, () => {
      const leaf = spawn(random, radius)
      leaf.p.y = 0.4 + random() * 1.6 // começam espalhadas na altura, não todas lá em cima
      return leaf
    })
  }, [random, radius])

  const ref = useRef<InstancedMesh>(null)
  const m = useMemo(() => ({ matrix: new Matrix4(), q: new Quaternion(), e: new Euler(0, 0, 0, 'YXZ'), at: new Vector3(), s: new Vector3() }), [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    const palette = colors.map((c) => new Color(c))
    for (let i = 0; i < count; i++) mesh.setColorAt(i, palette[i % palette.length])
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [colors])

  useFrame(({ clock }, rawDelta) => {
    const mesh = ref.current
    if (!mesh) return
    const delta = Math.min(rawDelta, 0.05) // aba voltando do fundo: sem pulo gigante
    const t = clock.elapsedTime
    leaves.forEach((leaf, i) => {
      leaf.grow = Math.min(1, leaf.grow + delta * 2.5)
      const ground = Math.hypot(leaf.p.x, leaf.p.z) < radius * 0.97 ? heightAt(leaf.p.x, leaf.p.z) + 0.012 : -3
      if (leaf.resting > 0) {
        // no chão: deitada, parada; no fim encolhe e volta a cair lá de cima
        leaf.resting -= delta
        if (leaf.resting <= 0) Object.assign(leaf, spawn(random, radius))
        const shrink = Math.min(1, Math.max(0, leaf.resting) / 0.6)
        m.e.set(-Math.PI / 2 + 0.08, leaf.yaw, 0.1)
        m.s.setScalar(shrink)
        mesh.setMatrixAt(i, m.matrix.compose(leaf.p, m.q.setFromEuler(m.e), m.s))
        return
      }
      // pêndulo: o balanço lateral é um seno; a folha inclina pro lado em que está indo (cosseno)
      const swing = Math.sin(t * leaf.freq + leaf.phase)
      const lean = Math.cos(t * leaf.freq + leaf.phase)
      // cai mais rápido no meio do balanço e quase para nas pontas (como folha de verdade)
      const vy = leaf.fall * (0.35 + 0.65 * Math.abs(lean))
      leaf.p.y -= vy * delta
      leaf.p.addScaledVector(WIND, delta)
      leaf.yaw += leaf.spin * delta
      m.at.copy(leaf.p).addScaledVector(leaf.dir, swing * leaf.amp)
      if (m.at.y <= ground) {
        leaf.p.copy(m.at).setY(ground)
        leaf.resting = ground < -2 ? 0.01 : 2.5 + random() * 3
        return
      }
      if (leaf.p.y < -3) Object.assign(leaf, spawn(random, radius))
      m.e.set(lean * 0.75 - 0.2, leaf.yaw, swing * 0.5)
      m.s.setScalar(leaf.grow)
      mesh.setMatrixAt(i, m.matrix.compose(m.at, m.q.setFromEuler(m.e), m.s))
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} castShadow name="falling-leaves" />
}

function spawn(random: () => number, radius: number): Leaf {
  const a = random() * TAU
  const r = radius * Math.sqrt(random()) * 0.75
  const d = random() * TAU
  return {
    p: new Vector3(Math.cos(a) * r, 1.3 + random() * 0.8, Math.sin(a) * r),
    phase: random() * TAU,
    freq: 1.6 + random() * 1.2,
    amp: 0.12 + random() * 0.12,
    dir: new Vector3(Math.cos(d), 0, Math.sin(d)),
    fall: 0.16 + random() * 0.1,
    yaw: random() * TAU,
    spin: (random() - 0.5) * 0.8,
    resting: 0,
    grow: 0,
  }
}

/** Um lugar ao acaso por cima da ilha, na altura `y`. */
function flakeSpot(random: () => number, radius: number, y: number) {
  const a = random() * TAU
  const r = radius * Math.sqrt(random())
  return { x: Math.cos(a) * r, y, z: Math.sin(a) * r }
}

/** Neve caindo por cima da ilha. Branca sem sombreado (MeshBasic): floco não tem lado escuro. */
export function Snowfall({ radius, heightAt }: { radius: number; heightAt: IslandShape['heightAt'] }) {
  const count = 90
  const geometry = useMemo(() => new IcosahedronGeometry(0.02, 0), [])
  const material = useMemo(() => new MeshBasicMaterial({ color: '#ffffff' }), [])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => geometry.dispose(), [geometry])

  const random = useMemo(() => rng(17), [])
  // começa com os flocos espalhados na altura; depois, quem toca o chão volta lá pra cima
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        ...flakeSpot(random, radius, -0.2 + random() * 3.2),
        phase: random() * TAU,
        freq: 0.8 + random() * 1.2,
        amp: 0.04 + random() * 0.08,
        fall: 0.18 + random() * 0.16,
        size: 0.6 + random() * 0.8,
      })),
    [random, radius],
  )

  const ref = useRef<InstancedMesh>(null)
  const m = useMemo(() => ({ matrix: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3() }), [])
  useLayoutEffect(() => {
    ref.current?.instanceMatrix.setUsage(DynamicDrawUsage)
  }, [])

  useFrame(({ clock }, rawDelta) => {
    const mesh = ref.current
    if (!mesh) return
    const delta = Math.min(rawDelta, 0.05)
    const t = clock.elapsedTime
    flakes.forEach((f, i) => {
      f.y -= f.fall * delta
      f.x += WIND.x * 0.8 * delta
      f.z += WIND.z * 0.8 * delta
      const onIsland = Math.hypot(f.x, f.z) < radius * 0.97
      const ground = onIsland ? heightAt(f.x, f.z) : -2.5
      if (f.y <= ground) Object.assign(f, flakeSpot(random, radius, 2.6 + random() * 0.8))
      m.p.set(f.x + Math.sin(t * f.freq + f.phase) * f.amp, f.y, f.z + Math.cos(t * f.freq * 0.8 + f.phase) * f.amp)
      m.s.setScalar(f.size)
      mesh.setMatrixAt(i, m.matrix.compose(m.p, m.q, m.s))
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} name="snowfall" />
}

export interface Burst {
  id: string
  x: number
  z: number
  color: string
}

/** Pétalas triangulares caindo de uma planta que acabou de ficar adulta. */
export function PetalBurst({ burst, onDone }: { burst: Burst; onDone: (id: string) => void }) {
  const count = 30
  const geometry = useMemo(() => triangleGeometry(new Color(burst.color), 0.025, 0.06), [burst.color])
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide }), [])
  useEffect(() => () => material.dispose(), [material])

  const parts = useMemo(() => {
    const random = rng(burst.id.length * 7919)
    return Array.from({ length: count }, () => {
      const a = random() * TAU
      const speed = 0.25 + random() * 0.5
      return {
        p: new Vector3(burst.x, 0.95 + random() * 0.15, burst.z),
        v: new Vector3(Math.cos(a) * speed, 0.35 + random() * 0.5, Math.sin(a) * speed),
        r: new Euler(random() * TAU, random() * TAU, 0),
        spin: new Vector3(random() * 4 - 2, random() * 4 - 2, random() * 4 - 2),
      }
    })
  }, [burst])

  const ref = useRef<InstancedMesh>(null)
  const age = useRef(0)
  const tmp = useMemo(() => ({ matrix: new Matrix4(), q: new Quaternion(), s: new Vector3() }), [])

  useLayoutEffect(() => {
    ref.current?.instanceMatrix.setUsage(DynamicDrawUsage) // as posições mudam todo frame
  }, [])

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    if (age.current < 0) return
    age.current += delta
    const life = age.current / 4.5
    if (life >= 1) {
      age.current = -1 // avisa uma vez só
      onDone(burst.id)
      return
    }
    parts.forEach((part, i) => {
      part.v.y -= 0.55 * delta // gravidade fraca: pétala cai planando
      part.v.multiplyScalar(1 - 0.9 * delta)
      part.p.addScaledVector(part.v, delta)
      part.p.y = Math.max(part.p.y, 0.02)
      part.r.x += part.spin.x * delta
      part.r.y += part.spin.y * delta
      part.r.z += part.spin.z * delta
      tmp.s.setScalar(1 - Math.max(0, life - 0.7) / 0.3)
      mesh.setMatrixAt(i, tmp.matrix.compose(part.p, tmp.q.setFromEuler(part.r), tmp.s))
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} castShadow name="petal-burst" />
}
