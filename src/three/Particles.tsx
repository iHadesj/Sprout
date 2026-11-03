// O que flutua no ar: folhinhas soltas e as pétalas que caem quando uma planta
// fica adulta. Tudo leve: poucas partículas, desenhadas com instancing.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DoubleSide, DynamicDrawUsage, Euler, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry } from 'three'
import { MeshBuilder } from './meshBuilder'
import { rng } from './random'

const TAU = Math.PI * 2

function triangleGeometry(color: Color, width: number, length: number): BufferGeometry {
  const b = new MeshBuilder(rng(3), 0.1)
  b.triangle(new Vector3(-width, 0, 0), new Vector3(width, 0, 0), new Vector3(0, 0, length), color, color, color.clone().offsetHSL(0, 0, 0.1))
  return b.build()
}

/** Algumas folhinhas dando voltas devagar por cima da ilha. */
export function DriftingLeaves({ radius }: { radius: number }) {
  const count = 5
  const geometry = useMemo(() => triangleGeometry(new Color('#7fc767'), 0.03, 0.09), [])
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide }), [])
  useEffect(() => () => material.dispose(), [material])
  const paths = useMemo(() => {
    const random = rng(99)
    return Array.from({ length: count }, () => ({
      r: radius * (0.3 + random() * 0.6),
      phase: random() * TAU,
      speed: 0.08 + random() * 0.08,
      height: 0.9 + random() * 1.2,
      spin: 0.6 + random(),
    }))
  }, [radius])
  const ref = useRef<InstancedMesh>(null)
  const m = useMemo(() => ({ matrix: new Matrix4(), q: new Quaternion(), e: new Euler(), p: new Vector3(), s: new Vector3(1, 1, 1) }), [])

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    paths.forEach((path, i) => {
      const a = path.phase + t * path.speed
      m.p.set(Math.cos(a) * path.r, path.height + Math.sin(t * 0.7 + path.phase) * 0.25, Math.sin(a) * path.r)
      m.e.set(Math.sin(t * path.spin) * 0.8, a * 2, Math.cos(t * path.spin) * 0.6)
      mesh.setMatrixAt(i, m.matrix.compose(m.p, m.q.setFromEuler(m.e), m.s))
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />
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
