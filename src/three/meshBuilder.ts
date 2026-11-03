// Monta geometria de triângulos soltos (não indexados), cada um com:
// - cor por vértice (com uma variação pequena por face, que realça as facetas);
// - "leafy": 1 em folha/caule, que o shader amarela quando o jardim fica esquecido;
// - "bary": coordenadas baricêntricas (1,0,0 / 0,1,0 / 0,0,1), com que o shader acha
//   as arestas de cada triângulo e acende um fio de luz nelas.
import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three'

export class MeshBuilder {
  private positions: number[] = []
  private colors: number[] = []
  private leafy: number[] = []
  private bary: number[] = []
  private readonly random: () => number
  private readonly jitter: number

  /** `jitter` = quanto o brilho de cada face varia (0.06 = ±6%). */
  constructor(random: () => number, jitter = 0.06) {
    this.random = random
    this.jitter = jitter
  }

  triangle(a: Vector3, b: Vector3, c: Vector3, ca: Color, cb: Color = ca, cc: Color = ca, leafy = 0) {
    const k = 1 + (this.random() * 2 - 1) * this.jitter
    this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    for (const color of [ca, cb, cc]) this.colors.push(color.r * k, color.g * k, color.b * k)
    this.leafy.push(leafy, leafy, leafy)
    this.bary.push(1, 0, 0, 0, 1, 0, 0, 0, 1)
  }

  /**
   * Triângulo virado pra `facing` (ex.: pra fora da ilha). Faces só aparecem pela frente,
   * e a frente depende da ordem dos vértices; aqui a ordem é corrigida se precisar.
   */
  triangleFacing(a: Vector3, b: Vector3, c: Vector3, facing: Vector3, ca: Color, cb: Color = ca, cc: Color = ca, leafy = 0) {
    const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a))
    if (normal.dot(facing) >= 0) this.triangle(a, b, c, ca, cb, cc, leafy)
    else this.triangle(a, c, b, ca, cc, cb, leafy)
  }

  /**
   * Grade de pontos (linhas x colunas) virando triângulos. A diagonal de cada quadrado
   * alterna de lado, que dá o visual de "papel dobrado" em vez de listras.
   */
  grid(points: Vector3[][], colorAt: (row: number, col: number) => Color, leafy = 0) {
    for (let j = 0; j < points.length - 1; j++) {
      for (let i = 0; i < points[j].length - 1; i++) {
        const a = points[j][i]
        const b = points[j][i + 1]
        const c = points[j + 1][i]
        const d = points[j + 1][i + 1]
        const [ca, cb, cc, cd] = [colorAt(j, i), colorAt(j, i + 1), colorAt(j + 1, i), colorAt(j + 1, i + 1)]
        if ((i + j) % 2 === 0) {
          this.triangle(a, b, d, ca, cb, cd, leafy)
          this.triangle(a, d, c, ca, cd, cc, leafy)
        } else {
          this.triangle(a, b, c, ca, cb, cc, leafy)
          this.triangle(b, d, c, cb, cd, cc, leafy)
        }
      }
    }
  }

  /** Leque de triângulos de um centro até um anel (tampas, discos). */
  fan(center: Vector3, ring: Vector3[], centerColor: Color, ringColor: Color = centerColor, leafy = 0, closed = true) {
    const n = closed ? ring.length : ring.length - 1
    for (let i = 0; i < n; i++) this.triangle(center, ring[i], ring[(i + 1) % ring.length], centerColor, ringColor, ringColor, leafy)
  }

  get triangleCount() {
    return this.positions.length / 9
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3))
    geometry.setAttribute('leafy', new BufferAttribute(new Float32Array(this.leafy), 1))
    geometry.setAttribute('bary', new BufferAttribute(new Float32Array(this.bary), 3))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
  }
}
