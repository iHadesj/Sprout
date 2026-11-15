// Materiais do cervinho da surpresa (ver Fawn.tsx): pelo e olhos. Os dois respeitam o mesmo
// plano de corte, que é o que faz ele sumir atrás da árvore.
import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { DoubleSide, Plane, Vector3 } from 'three'
import { createFacetMaterial } from './facetMaterial'

export function useFawnMaterials() {
  const made = useMemo(() => {
    // começa longe: nada é cortado até a fuga
    const plane = new Plane(new Vector3(0, 1, 0), 1e4)
    const coat = createFacetMaterial({ side: DoubleSide, edge: 0.16, rim: 0.26, roughness: 0.82 })
    const eye = createFacetMaterial({ side: DoubleSide, edge: 0, rim: 0.5, roughness: 0.25 })
    for (const m of [coat, eye]) {
      m.clippingPlanes = [plane]
      m.clipShadows = true
    }
    return { plane, coat, eye }
  }, [])
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    // por padrão o three ignora planos de corte que são de um material só
    const before = gl.localClippingEnabled
    gl.localClippingEnabled = true
    return () => {
      gl.localClippingEnabled = before
      made.coat.dispose()
      made.eye.dispose()
    }
  }, [gl, made])
  return made
}
