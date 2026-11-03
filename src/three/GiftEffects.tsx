// Presentes de amigos na cena: o regador que chega, inclina, rega a ilha e vai embora, os
// corações facetados que sobem da ilha (poucos e grandes, ou uma nuvem quando são muitos), os
// fogos dos aplausos e a sementinha do "bora focar" (os dois últimos em CheerEffects).
// Só enfeite: nada aqui mexe nas plantas. Quem chama troca o `id` pra tocar de novo.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { DynamicDrawUsage, Group, InstancedMesh, Matrix4, Quaternion, Vector3, Euler } from 'three'
import { Fireworks, SeedCall } from './CheerEffects'
import { createFacetMaterial } from './facetMaterial'
import { dropGeometry, SPOUT_TIP, wateringCanGeometry } from './gifts'
import { heartGeometry } from './heart'
import { rng } from './random'

export interface GiftShow {
  /** muda a cada vez que é pra tocar (de novo) */
  id: number
  water: boolean
  hearts: number
  /** aplausos recebidos: viram fogos de artifício */
  claps?: number
  /** alguém chamou pra focar */
  seed?: boolean
}

/** No máximo isto de corações na tela: 999 vira uma nuvem densa sem travar o celular. */
const MAX_HEARTS = 160
const TAU = Math.PI * 2

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

export function GiftEffects({ show, radius, motion }: { show: GiftShow; radius: number; motion: boolean }) {
  return (
    <group name="gift-effects">
      {show.water && <WateringCan key={`w${show.id}`} radius={radius} motion={motion} />}
      {show.hearts > 0 && <HeartCloud key={`h${show.id}`} count={show.hearts} radius={radius} motion={motion} delay={show.water ? 3.2 : 0} />}
      {!!show.claps && <Fireworks key={`c${show.id}`} count={show.claps} radius={radius} delay={(show.water ? 2 : 0) + (show.hearts ? 1.5 : 0)} />}
      {show.seed && <SeedCall key={`s${show.id}`} delay={show.water || show.hearts ? 1 : 0} />}
    </group>
  )
}

const CAN_LIFE = 5.2
const DROPS = 36

function WateringCan({ radius, motion }: { radius: number; motion: boolean }) {
  const can = useMemo(() => wateringCanGeometry(), [])
  const drop = useMemo(() => dropGeometry(), [])
  const material = useMemo(() => createFacetMaterial({ edge: 0.45, rim: 0.3, roughness: 0.35 }), [])
  useEffect(
    () => () => {
      can.dispose()
      drop.dispose()
      material.dispose()
    },
    [can, drop, material],
  )

  const group = useRef<Group>(null)
  const drops = useRef<InstancedMesh>(null)
  const age = useRef(0)
  const invalidate = useThree((s) => s.invalidate)
  const state = useMemo(() => {
    const random = rng(7)
    return Array.from({ length: DROPS }, () => ({ born: -1, p: new Vector3(), v: new Vector3(), jitter: random() }))
  }, [])
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), s: new Vector3(), tip: new Vector3(), zero: new Matrix4().makeScale(0, 0, 0) }), [])
  // o regador fica acima de um ponto entre o centro e a frente da ilha, inclinando pra ele
  const target = useMemo(() => new Vector3(-radius * 0.35, 2.2, radius * 0.15), [radius])

  useLayoutEffect(() => {
    const mesh = drops.current
    if (!mesh) return
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    for (let i = 0; i < DROPS; i++) mesh.setMatrixAt(i, tmp.zero)
  }, [tmp])

  useFrame((_, delta) => {
    const g = group.current
    const mesh = drops.current
    if (!g || !mesh || age.current < 0) return
    const dt = Math.min(delta, 0.05)
    age.current += dt
    const t = age.current
    if (t > CAN_LIFE + 1.2) {
      age.current = -1
      g.visible = false
      return
    }
    // chega descendo, inclina, rega, desinclina e sobe sumindo
    const arrive = smooth(t / 0.8)
    const leave = smooth((t - (CAN_LIFE - 0.8)) / 0.8)
    const tilt = smooth((t - 0.8) / 0.5) * (1 - smooth((t - (CAN_LIFE - 1.2)) / 0.4))
    const wobble = motion ? Math.sin(t * 6) * 0.03 * tilt : 0
    g.position.set(target.x, target.y + (1 - arrive) * 1.6 + leave * 1.4, target.z)
    g.rotation.set(0, -0.5, -0.75 * tilt + wobble)
    g.scale.setScalar(0.55 * arrive * (1 - leave))

    // gotas: nascem na ponta do bico enquanto inclinado e caem com gravidade até o chão
    const pouring = tilt > 0.85
    g.updateMatrixWorld()
    tmp.tip.copy(SPOUT_TIP)
    g.localToWorld(tmp.tip)
    g.parent?.worldToLocal(tmp.tip)
    state.forEach((d, i) => {
      if (d.born < 0 || d.p.y < 0.02) {
        if (!pouring) {
          d.born = -1
          mesh.setMatrixAt(i, tmp.zero)
          return
        }
        // espalha os nascimentos pra sair um fiozinho contínuo
        if (Math.random() > 0.25) return
        d.born = t
        d.p.copy(tmp.tip)
        d.v.set(0.5 + d.jitter * 0.4, 0.2, (d.jitter - 0.5) * 0.5)
      }
      d.v.y -= 6 * dt
      d.p.addScaledVector(d.v, dt)
      tmp.s.setScalar(0.9 + d.jitter * 0.4)
      mesh.setMatrixAt(i, tmp.m.compose(d.p, tmp.q.identity(), tmp.s))
    })
    mesh.instanceMatrix.needsUpdate = true
    invalidate()
  })

  return (
    <>
      <group ref={group} scale={0}>
        <mesh geometry={can} material={material} castShadow name="watering-can" />
      </group>
      <instancedMesh ref={drops} args={[drop, material, DROPS]} frustumCulled={false} />
    </>
  )
}

interface HeartState {
  start: number
  life: number
  base: Vector3
  rise: number
  spin: number
  size: number
  phase: number
}

function HeartCloud({ count, radius, motion, delay }: { count: number; radius: number; motion: boolean; delay: number }) {
  const shown = Math.min(count, MAX_HEARTS)
  const geometry = useMemo(() => heartGeometry(), [])
  const material = useMemo(() => createFacetMaterial({ edge: 0.6, rim: 0.4, roughness: 0.45 }), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  // poucos corações: grandes, saindo do meio; muitos: pequenos, espalhados pela ilha toda
  const hearts = useMemo<HeartState[]>(() => {
    const random = rng(count * 7 + 3)
    const many = shown > 12
    const spread = many ? Math.min(4, 0.6 + shown * 0.025) : shown * 0.35
    return Array.from({ length: shown }, () => {
      const r = (many ? radius * 0.8 : radius * 0.35) * Math.sqrt(random())
      const a = random() * TAU
      return {
        start: delay + random() * spread,
        life: 3.4 + random() * 1.8,
        base: new Vector3(Math.cos(a) * r, 0.3 + random() * 0.5, Math.sin(a) * r),
        rise: 0.6 + random() * 0.6,
        spin: (random() - 0.5) * 3,
        size: many ? 0.12 + random() * 0.14 : 0.32 + random() * 0.12,
        phase: random() * TAU,
      }
    })
  }, [count, shown, radius, delay])

  const ref = useRef<InstancedMesh>(null)
  const age = useRef(0)
  const invalidate = useThree((s) => s.invalidate)
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), e: new Euler(), p: new Vector3(), s: new Vector3() }), [])
  const end = useMemo(() => Math.max(...hearts.map((h) => h.start + h.life)), [hearts])

  // começa tudo escondido (escala 0) até cada coração chegar na sua vez
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    const hidden = new Matrix4().makeScale(0, 0, 0)
    for (let i = 0; i < shown; i++) mesh.setMatrixAt(i, hidden)
    mesh.instanceMatrix.needsUpdate = true
  }, [shown])

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
    hearts.forEach((h, i) => {
      const k = (t - h.start) / h.life
      if (k <= 0 || k >= 1) {
        tmp.s.setScalar(0)
        mesh.setMatrixAt(i, tmp.m.compose(h.base, tmp.q.identity(), tmp.s))
        return
      }
      // aparece com um pulinho, sobe balançando e some encolhendo
      const pop = Math.min(1, k / 0.12)
      const grow = 1 + 2.2 * (pop - 1) ** 3 + 1.2 * (pop - 1) ** 2
      const fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1
      const lived = t - h.start
      tmp.p.set(
        h.base.x + (motion ? Math.sin(lived * 1.6 + h.phase) * 0.12 : 0),
        h.base.y + (motion ? lived * h.rise : k * 0.6),
        h.base.z + (motion ? Math.cos(lived * 1.3 + h.phase) * 0.1 : 0),
      )
      tmp.e.set(0, h.phase + (motion ? lived * h.spin : 0), motion ? Math.sin(lived * 2 + h.phase) * 0.2 : 0)
      tmp.s.setScalar(h.size * grow * fade)
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q.setFromEuler(tmp.e), tmp.s))
    })
    mesh.instanceMatrix.needsUpdate = true
    invalidate()
  })

  return <instancedMesh ref={ref} args={[geometry, material, shown]} frustumCulled={false} castShadow name="heart-cloud" />
}
