// O cervinho da surpresa: quando o jardim abre, um filhote chega pulando, para ao lado da
// árvore velha, olha pra quem está vendo e, de repente, corre pra trás do tronco e some.
//
// O sumiço é o truque de filme: ele passa por trás da árvore e não sai do outro lado. Pra
// funcionar de qualquer ângulo, existe um plano invisível que passa pela câmera e pelo meio do
// tronco; o que estiver do lado "de lá" desse plano não é desenhado. Como a borda do plano fica
// sempre escondida atrás do tronco, ninguém vê o corte. O caminho da fuga também é calculado em
// relação à câmera (ver fleePath no fawnMotion.ts).
//
// É cenário: não está no banco e não mexe em sessão nem em planta.
import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, Quaternion, Vector3 } from 'three'
import type { FacetMaterial } from './facetMaterial'
import { FACE, fawnParts } from './fawnGeometry'
import { fawnMoment, fleePath, HIDDEN_PAST, lerpAngle, RIG, settle, wrapAngle, type FawnPlan, type FawnPose, type FleePath, type LegPose, type Vec2 } from './fawnMotion'
import type { IslandShape } from './islandGeometry'
import { clamp, lerp } from './random'
import { useFawnMaterials } from './useFawnMaterials'

/** Tamanho do cervinho na ilha (1 = 0,5 de altura até a ponta da orelha). */
const SIZE = 1.4

const AXIS_X = new Vector3(1, 0, 0)
const AXIS_Y = new Vector3(0, 1, 0)
const AXIS_Z = new Vector3(0, 0, 1)

export interface FawnHandle {
  root: Group | null
  /** aplica a pose; `look` = pra onde a cabeça vira pra achar a câmera (em relação ao corpo) */
  apply: (pose: FawnPose, look: { yaw: number; pitch: number }) => void
}

interface FawnModelProps {
  ref: Ref<FawnHandle>
  material: FacetMaterial
  eyeMaterial: FacetMaterial
}

/** Orelha: -1 = deitada pra trás, 0 = solta, 1 = em pé. Devolve [abrir pro lado, girar, tombar]. */
function earAngles(state: number): [number, number, number] {
  const loose = [0.75, 0.6, -0.25]
  const target = state >= 0 ? [0.38, 0.22, 0.06] : [0.55, 0.7, -1.0]
  const k = Math.abs(state)
  return [lerp(loose[0], target[0], k), lerp(loose[1], target[1], k), lerp(loose[2], target[2], k)]
}

/** O boneco: as partes do cervinho penduradas umas nas outras, cada uma na sua articulação. */
export function FawnModel({ ref, material, eyeMaterial }: FawnModelProps) {
  const parts = fawnParts()
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const neck = useRef<Group>(null)
  const head = useRef<Group>(null)
  const tail = useRef<Group>(null)
  const ears = useRef<(Group | null)[]>([])
  const eyes = useRef<(Group | null)[]>([])
  // pernas: [frente esq., frente dir., trás esq., trás dir.], cada uma com coxa e canela
  const upper = useRef<(Group | null)[]>([])
  const lower = useRef<(Group | null)[]>([])
  const scratch = useMemo(() => ({ q: new Quaternion(), turn: new Quaternion() }), [])

  useImperativeHandle(ref, () => ({
    get root() {
      return root.current
    },
    apply(pose, look) {
      const { pitch, y } = settle(pose)
      if (body.current) {
        body.current.position.y = RIG.pivotY + y
        body.current.rotation.set(pitch, 0, pose.roll)
      }
      const legs: LegPose[] = [pose.front[0], pose.front[1], pose.hind[0], pose.hind[1]]
      legs.forEach((leg, i) => {
        if (upper.current[i]) upper.current[i]!.rotation.x = leg.upper
        if (lower.current[i]) lower.current[i]!.rotation.x = leg.lower
      })
      // o pescoço faz parte da virada e a cabeça faz o resto
      const yaw = look.yaw * pose.look
      neck.current?.rotation.set(pose.neck, yaw * 0.38, 0, 'YXZ')
      if (head.current) {
        // a cabeça desfaz a inclinação do pescoço (fica nivelada) e só então vira, levanta e tomba
        const { q, turn } = scratch
        q.setFromAxisAngle(AXIS_X, -pose.neck)
        q.multiply(turn.setFromAxisAngle(AXIS_Y, yaw * 0.62))
        q.multiply(turn.setFromAxisAngle(AXIS_X, pose.headPitch + look.pitch * pose.look))
        q.multiply(turn.setFromAxisAngle(AXIS_Z, pose.headRoll))
        head.current.quaternion.copy(q)
      }
      ears.current.forEach((ear, i) => {
        if (!ear) return
        const side = i === 0 ? 1 : -1
        const [open, spin, tip] = earAngles(pose.ears[i])
        ear.rotation.set(tip, side * spin, -side * open)
      })
      eyes.current.forEach((eye) => eye?.scale.setY(1 - 0.92 * pose.blink))
      tail.current?.rotation.set(lerp(-2.7, -0.5, pose.tail), 0, pose.tailWag)
    },
  }))

  const hips: [number, number, number][] = [
    [RIG.front.x, RIG.front.y, RIG.front.z],
    [-RIG.front.x, RIG.front.y, RIG.front.z],
    [RIG.hind.x, RIG.hind.y, RIG.hind.z],
    [-RIG.hind.x, RIG.hind.y, RIG.hind.z],
  ]

  return (
    <group ref={root} name="fawn" visible={false}>
      <group ref={body} position={[0, RIG.pivotY, 0]}>
        <group position={[0, -RIG.pivotY, 0]}>
          <mesh geometry={parts.torso} material={material} castShadow />
          {hips.map((hip, i) => {
            const pair = i < 2 ? RIG.front : RIG.hind
            return (
              <group key={i} position={hip} ref={(g) => void (upper.current[i] = g)}>
                <mesh geometry={i < 2 ? parts.frontUpper : parts.hindUpper} material={material} castShadow />
                <group position={[0, -pair.upper, 0]} ref={(g) => void (lower.current[i] = g)}>
                  <mesh geometry={i < 2 ? parts.frontLower : parts.hindLower} material={material} castShadow />
                </group>
              </group>
            )
          })}
          <group ref={tail} position={[0, RIG.tail.y, RIG.tail.z]}>
            <mesh geometry={parts.tail} material={material} castShadow />
          </group>
          <group ref={neck} position={[0, RIG.neck.y, RIG.neck.z]}>
            <mesh geometry={parts.neck} material={material} castShadow />
            <group ref={head} position={[0, RIG.neck.length, 0]}>
              <mesh geometry={parts.head} material={material} castShadow />
              {[1, -1].map((side, i) => (
                <group key={side}>
                  <group position={[FACE.ear.x * side, FACE.ear.y, FACE.ear.z]} ref={(g) => void (ears.current[i] = g)}>
                    <mesh geometry={parts.ear} material={material} castShadow />
                  </group>
                  <group
                    position={[FACE.eye.x * side, FACE.eye.y, FACE.eye.z]}
                    rotation={[0, -0.3 * side, 0]}
                    scale={[side, 1, 1]}
                    ref={(g) => void (eyes.current[i] = g)}
                  >
                    <mesh geometry={parts.eye} material={eyeMaterial} />
                  </group>
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

interface FawnProps {
  plan: FawnPlan
  /** onde está a árvore velha */
  tree: Vec2
  heightAt: IslandShape['heightAt']
  /** chamado quando ele some atrás da árvore */
  onDone: () => void
}

export function Fawn({ plan, tree, heightAt, onDone }: FawnProps) {
  const model = useRef<FawnHandle>(null)
  const { plane, coat, eye } = useFawnMaterials()
  const camera = useThree((s) => s.camera)
  const state = useRef({ t: 0, hold: false, hops: plan.hops, act: plan.show.act, done: false, heading: plan.enterHeading, look: { yaw: 0, pitch: 0 }, flee: null as FleePath | null, x: plan.start.x, z: plan.start.z })
  const scratch = useMemo(() => ({ cam: new Vector3(), normal: new Vector3(), point: new Vector3() }), [])

  useEffect(() => {
    // em desenvolvimento: dá pra parar o tempo e conferir cada momento (testes E2E)
    if (!import.meta.env.DEV) return
    const s = state.current
    window.__sproutFawn = s
    return () => {
      if (window.__sproutFawn === s) window.__sproutFawn = undefined
    }
  }, [])

  useFrame((_, delta) => {
    const s = state.current
    const root = model.current?.root
    if (!root?.parent || s.done) return
    if (!s.hold) s.t += Math.min(delta, 0.05) // quadro travado (aba voltando) não pula a cena
    const now = fawnMoment(s.t, plan.hops, plan.show)
    if (now.phase === 'wait') return
    root.visible = true

    // a câmera vista de dentro da ilha (que flutua e balança)
    const cam = root.parent.worldToLocal(scratch.cam.copy(camera.position))
    const away = Math.hypot(cam.x - tree.x, cam.z - tree.z)
    const toCam = away > 1e-3 ? { x: (cam.x - tree.x) / away, z: (cam.z - tree.z) / away } : plan.toCamera
    const right = { x: toCam.z, z: -toCam.x }

    if (now.phase !== 'startle' && now.phase !== 'flee') {
      s.x = lerp(plan.start.x, plan.stop.x, now.travel)
      s.z = lerp(plan.start.z, plan.stop.z, now.travel)
      s.heading = lerpAngle(plan.enterHeading, plan.stopHeading, now.turn)
    } else {
      // susto e fuga: o caminho é fixado em relação à câmera no instante do susto
      s.flee ??= fleePath((s.x - tree.x) * right.x + (s.z - tree.z) * right.z, (s.x - tree.x) * toCam.x + (s.z - tree.z) * toCam.z)
      const p = s.flee.at(now.fled)
      const goal = Math.atan2(right.x * p.da + toCam.x * p.db, right.z * p.da + toCam.z * p.db)
      if (now.phase === 'startle') {
        // no susto ele só começa a virar pro lado da fuga
        s.heading = lerpAngle(plan.stopHeading, goal, 0.45 * now.startle)
      } else {
        s.x = tree.x + right.x * p.a + toCam.x * p.b
        s.z = tree.z + right.z * p.a + toCam.z * p.b
        s.heading = lerpAngle(s.heading, goal, 1 - Math.exp(-delta * 16))
        // já atrás da árvore: liga o corte. Fica desenhado só o lado de onde ele veio.
        if (p.b < 0) {
          scratch.normal.set(right.x * s.flee.side, 0, right.z * s.flee.side)
          scratch.point.set(tree.x, 0, tree.z)
          plane.setFromNormalAndCoplanarPoint(scratch.normal, scratch.point).applyMatrix4(root.parent.matrixWorld)
        }
        if (p.done || p.a * s.flee.side < -HIDDEN_PAST * SIZE) {
          s.done = true
          root.visible = false
          onDone()
          return
        }
      }
    }

    const ground = heightAt(s.x, s.z)
    const squash = now.pose.squash
    const wide = SIZE * now.scale / Math.sqrt(squash)
    root.position.set(s.x, ground, s.z)
    root.rotation.y = s.heading
    root.scale.set(wide, SIZE * now.scale * squash, wide)

    // pra onde a cabeça precisa virar pra olhar pra câmera
    const dx = cam.x - s.x
    const dz = cam.z - s.z
    const yaw = clamp(wrapAngle(Math.atan2(dx, dz) - s.heading), -1.75, 1.75)
    const pitch = clamp(-Math.atan2(cam.y - (ground + 0.4 * SIZE), Math.hypot(dx, dz)) * 0.7, -0.45, 0.2)
    const k = 1 - Math.exp(-delta * 10)
    s.look.yaw += (yaw - s.look.yaw) * k
    s.look.pitch += (pitch - s.look.pitch) * k
    model.current?.apply(now.pose, s.look)
  })

  return <FawnModel ref={model} material={coat} eyeMaterial={eye} />
}
