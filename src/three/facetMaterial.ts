// Material das árvores e da ilha: facetado (flatShading), com a cor vinda de cada vértice.
// O low poly aqui é proposital, então o shader realça as facetas em vez de escondê-las:
// - um fio de luz nas arestas de cada triângulo (atributo "bary" do MeshBuilder);
// - brilho de contorno (fresnel): as bordas viradas pro lado contrário da câmera acendem;
// - vento: o topo balança e a base fica parada, cada árvore com sua própria fase;
// - dissolver no papel: abaixo de certa altura, a cor vai virando a cor da página (a terra
//   embaixo da ilha some como uma aquarela, em vez de terminar num bico duro).
//
// O código extra é injetado no MeshStandardMaterial do three (onBeforeCompile), então luz,
// sombra e neblina continuam funcionando. Na cor ele ainda faz:
// dessaturar (murchar), puxar pro bege (seca), amarelar (jardim esquecido) e brilhar (cresceu).
import { Color, DoubleSide, FrontSide, MeshStandardMaterial, Vector3, type Side } from 'three'

export interface FacetUniforms {
  /** 1 = cores normais, 0 = tudo cinza */
  uSaturation: { value: number }
  /** quanto as cores puxam pro bege seco (árvore morta) */
  uDry: { value: number }
  /** folhas amarelando (jardim sem sessão há 3 dias) */
  uYellow: { value: number }
  /** brilho extra (troca de estágio) */
  uGlow: { value: number }
  /** relógio do vento, em segundos (parado se "reduzir movimento") */
  uTime: { value: number }
  /** quanto o vento entorta: deslocamento = uWind * altura² */
  uWind: { value: number }
  /** força do fio de luz nas arestas (0 = sem) */
  uEdge: { value: number }
  /** cor (já multiplicada pela força) do brilho de contorno */
  uRim: { value: Color }
  /** altura (no mundo) em que a cor já virou papel, e em que ainda está inteira */
  uFadeLo: { value: number }
  uFadeHi: { value: number }
  /** cor do papel em que a terra se dissolve (padrão: o papel da prancha) */
  uPaper: { value: Vector3 }
}

/** Cor do papel da prancha (--paper-card), já no espaço de cor da tela. */
const PAPER = new Vector3(0xf8, 0xf4, 0xea).divideScalar(255)

export type FacetMaterial = MeshStandardMaterial & { userData: { uniforms: FacetUniforms } }

interface FacetOptions {
  side?: Side
  saturation?: number
  dry?: number
  roughness?: number
  wind?: number
  edge?: number
  rim?: number
}

const RIM = new Color('#fff0cc')

export function createFacetMaterial(options: FacetOptions = {}): FacetMaterial {
  const uniforms: FacetUniforms = {
    uSaturation: { value: options.saturation ?? 1 },
    uDry: { value: options.dry ?? 0 },
    uYellow: { value: 0 },
    uGlow: { value: 0 },
    uTime: { value: 0 },
    uWind: { value: options.wind ?? 0 },
    uEdge: { value: options.edge ?? 0.3 },
    uRim: { value: RIM.clone().multiplyScalar(options.rim ?? 0.2) },
    uFadeLo: { value: -1e4 },
    uFadeHi: { value: -1e4 + 1 },
    uPaper: { value: PAPER.clone() },
  }

  const material = new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: options.roughness ?? 0.85,
    metalness: 0,
    side: options.side ?? FrontSide,
  }) as FacetMaterial
  material.userData.uniforms = uniforms

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float leafy;
attribute vec3 bary;
varying float vLeafy;
varying vec3 vBary;
varying float vFacetY;
uniform float uTime;
uniform float uWind;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vLeafy = leafy;
vBary = bary;
// vento: a fase vem da posição da árvore no mundo, então cada uma balança de um jeito
vec3 windOrigin = vec3(0.0);
#ifdef USE_INSTANCING
windOrigin = instanceMatrix[3].xyz;
#endif
windOrigin = (modelMatrix * vec4(windOrigin, 1.0)).xyz;
float windPhase = windOrigin.x * 1.7 + windOrigin.z * 1.3;
float windBend = uWind * max(position.y, 0.0) * max(position.y, 0.0);
transformed.x += (sin(uTime * 1.3 + windPhase) + 0.3 * sin(uTime * 3.7 + windPhase * 1.9)) * windBend;
transformed.z += cos(uTime * 1.05 + windPhase * 0.8) * windBend * 0.6;
vec4 facetWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
facetWorld = instanceMatrix * facetWorld;
#endif
vFacetY = (modelMatrix * facetWorld).y;`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vLeafy;
varying vec3 vBary;
uniform float uSaturation;
uniform float uDry;
uniform float uYellow;
uniform float uGlow;
uniform float uEdge;
uniform vec3 uRim;
uniform float uFadeLo;
uniform float uFadeHi;
uniform vec3 uPaper;
varying float vFacetY;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec3 facetColor = diffuseColor.rgb;
// folhas amarelam quando o jardim fica esquecido
vec3 facetYellow = vec3(dot(facetColor, vec3(0.75, 0.55, 0.0)), dot(facetColor, vec3(0.55, 0.55, 0.0)), facetColor.b * 0.4);
facetColor = mix(facetColor, facetYellow, uYellow * vLeafy);
// fio de luz nas arestas: distância até a aresta mais próxima, com largura de ~1 pixel
float facetEdgeDist = min(min(vBary.x, vBary.y), vBary.z);
float facetEdge = 1.0 - smoothstep(0.0, fwidth(facetEdgeDist) * 1.3, facetEdgeDist);
facetColor = mix(facetColor, facetColor * 1.35 + vec3(0.045, 0.04, 0.025), facetEdge * uEdge);
float facetLuma = dot(facetColor, vec3(0.299, 0.587, 0.114));
facetColor = mix(vec3(facetLuma), facetColor, uSaturation);
facetColor = mix(facetColor, vec3(facetLuma) * vec3(1.05, 0.95, 0.78), uDry);
diffuseColor.rgb = facetColor;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float facetFresnel = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);
totalEmissiveRadiance += facetColor * uGlow * 0.35 + (uRim + facetColor * 0.6 * length(uRim)) * facetFresnel;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
gl_FragColor.rgb = mix(uPaper, gl_FragColor.rgb, smoothstep(uFadeLo, uFadeHi, vFacetY));`,
      )
  }
  // todos os materiais facetados compartilham o mesmo programa de shader
  material.customProgramCacheKey = () => 'sprout-facet'
  return material
}

/** Árvores e brotos: folhas são superfícies finas (aparecem dos dois lados) e balançam. */
export function createPlantMaterial(): FacetMaterial {
  return createFacetMaterial({ side: DoubleSide, wind: 0.045, edge: 0.55, rim: 0.32, roughness: 0.6 })
}

/** Árvore morta: mesma forma, em bege seco e quase sem cor, parada. */
export function createDeadPlantMaterial(): FacetMaterial {
  return createFacetMaterial({ side: DoubleSide, saturation: 0.2, dry: 0.6, edge: 0.35, rim: 0.15 })
}
