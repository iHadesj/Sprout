// A ilha: a geometria (e a altura do chão) é calculada no GardenScene, aqui só é desenhada.
import { useEffect } from 'react'
import type { FacetMaterial } from './facetMaterial'
import type { IslandShape } from './islandGeometry'

export function Island({ shape, material }: { shape: IslandShape; material: FacetMaterial }) {
  useEffect(() => () => shape.geometry.dispose(), [shape])
  return <mesh geometry={shape.geometry} material={material} receiveShadow castShadow name="island" />
}
