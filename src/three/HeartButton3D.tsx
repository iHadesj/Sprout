// Coração 3D do botão de carinho (visita): o mesmo coração facetado do entalhe, girando devagar
// sobre uma sombrinha. Cada vez que `taps` muda (um toque, ou cada passada segurando), ele pula:
// sobe, dá meia volta e, ao cair, achata e volta com mola. Segurando, fica quicando.
// Com "reduzir movimento", só dá uma apertadinha no lugar. Quem é o botão é o HeartTap; aqui
// é só o desenho (o canvas não recebe clique).
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { NeutralToneMapping, type Group } from 'three'
import { createFacetMaterial } from './facetMaterial'
import { heartGeometry } from './heart'

const GRAVITY = 16
const JUMP = 3.4

export default function HeartButton3D({ taps, motion }: { taps: number; motion: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={motion ? 'always' : 'demand'}
      camera={{ position: [0, 0.35, 3], fov: 36 }}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl, camera }) => {
        gl.toneMapping = NeutralToneMapping
        camera.lookAt(0, 0.35, 0)
      }}
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <hemisphereLight args={['#fff1d6', '#6f7f99', 1]} />
      <directionalLight position={[2, 3, 2.5]} intensity={2.6} color="#ffe6bd" />
      <directionalLight position={[-2, 1, -2]} intensity={0.9} color="#cfe0ff" />
      <Heart taps={taps} motion={motion} />
      <ContactShadows position={[0, -0.47, 0]} opacity={0.32} scale={1.4} blur={2.4} far={1.4} frames={motion ? Infinity : 1} color="#5a2a1e" />
    </Canvas>
  )
}

function Heart({ taps, motion }: { taps: number; motion: boolean }) {
  const heart = useMemo(() => ({ geometry: heartGeometry(), material: createFacetMaterial({ edge: 0.6, rim: 0.45, roughness: 0.4 }) }), [])
  useEffect(
    () => () => {
      heart.geometry.dispose()
      heart.material.dispose()
    },
    [heart],
  )

  const ref = useRef<Group>(null)
  const invalidate = useThree((s) => s.invalidate)
  // altura e velocidade do pulo, achatamento (mola) e giro
  const s = useRef({ y: 0, vy: 0, squash: 0, sv: 0, yaw: 0, spin: 0, seen: taps })

  // cada toque: impulso pra cima (no ar, um empurrãozinho menor) e meia volta a mais
  useEffect(() => {
    const st = s.current
    if (taps === st.seen) return
    st.seen = taps
    if (motion) {
      st.vy = st.y > 0.02 ? Math.max(st.vy, JUMP * 0.7) : JUMP
      st.spin += Math.PI
      st.sv -= 2.5 // antecipação: encolhe antes de subir
    } else {
      st.sv -= 3
    }
    invalidate()
  }, [taps, motion, invalidate])

  useFrame((_, rawDelta) => {
    const g = ref.current
    if (!g) return
    const d = Math.min(rawDelta, 0.05)
    const st = s.current
    // pulo com gravidade; ao tocar o chão, a velocidade da queda vira achatamento
    st.vy -= GRAVITY * d
    st.y += st.vy * d
    if (st.y <= 0) {
      if (st.vy < -1) st.sv += st.vy * 0.9
      st.y = 0
      st.vy = 0
    }
    // achatamento: mola amortecida de volta pro 0
    st.sv += (-st.squash * 260 - st.sv * 14) * d
    st.squash += st.sv * d
    // giro: anda até o alvo do pulo e, parado, gira bem devagar
    const target = st.spin
    st.yaw += (target - st.yaw) * Math.min(1, d * 7)
    if (motion) st.spin += d * 0.5
    const k = Math.max(-0.35, Math.min(0.35, st.squash))
    g.position.y = st.y * 0.32
    g.scale.set(1 - k * 0.6, 1 + k, 1 - k * 0.6)
    g.rotation.set(0.12, st.yaw, 0)
    if (!motion && (Math.abs(st.squash) > 0.001 || Math.abs(st.sv) > 0.001)) invalidate()
  })

  return (
    <group ref={ref}>
      <mesh geometry={heart.geometry} material={heart.material} castShadow />
    </group>
  )
}
