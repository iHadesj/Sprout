// Luz da cena, como numa ilustração: sol de um lado, sombra puxada pro azul (o céu ilumina o
// que o sol não pega) e uma contraluz fria por trás, que acende as bordas das copas e separa as
// árvores do fundo de papel. Pouca luz "geral": é o contraste entre as faces que faz o low poly
// aparecer.
//
// A cor e a altura do sol vêm da hora do relógio (`daylight.ts`): de manhã ele é baixo e
// quente, ao meio-dia alto e claro, no fim da tarde dourado com sombra comprida, de noite vira
// um azul de luar. Quem não passa `light` (login, viveiro) fica no meio-dia de sempre.
//
// A caixa da sombra cresce quando o sol baixa: sombra comprida que saísse da caixa
// simplesmente não seria desenhada.
import type { Biome } from '../features/gardens/gardenOptions'
import { daylightAt, shadowReach, type Daylight } from './daylight'

interface SceneLightsProps {
  /** tamanho da ilha, pra caixa da sombra cobrir tudo */
  radius?: number
  biome?: Biome
  /** a luz daquela hora; sem ela, meio-dia */
  light?: Daylight
}

export function SceneLights({ radius = 6, biome = 'campo', light }: SceneLightsProps) {
  const day = light ?? daylightAt(12, biome)
  const shadow = radius + 1.6 + shadowReach(day.elevation, radius)
  // o sol fica longe o bastante pra estar sempre fora da ilha, na direção que a hora manda
  const far = radius * 2 + 12
  const sun: [number, number, number] = [day.direction.x * far, day.direction.y * far, day.direction.z * far]
  // contraluz: do lado oposto ao sol e atrás da ilha
  const rim: [number, number, number] = [-day.direction.x * (radius + 3), radius * 0.5 + 2, -(radius + 4)]

  return (
    <>
      <hemisphereLight args={[day.sky, day.ground, day.hemisphere]} />
      <directionalLight
        position={sun}
        color={day.sun}
        intensity={day.sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={5}
        shadow-blurSamples={12}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-camera-left={-shadow}
        shadow-camera-right={shadow}
        shadow-camera-top={shadow}
        shadow-camera-bottom={-shadow}
        shadow-camera-near={0.5}
        shadow-camera-far={radius * 5 + 30 + far}
      />
      <directionalLight position={rim} color={day.rim} intensity={day.rimIntensity} />
    </>
  )
}
