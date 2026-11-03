// Ilhazinha desenhada a traço (tinta só), como uma ilustração de caderno de campo.
// A única cor é a do jardim, nas copas. Usada no índice e enquanto a cena 3D carrega.
import type { Biome } from './gardenOptions'

interface IslandIconProps {
  color: string
  biome: Biome
  /** sem árvores (só a ilha) */
  empty?: boolean
}

/** Marquinhas no chão: tufos de grama, capim ou flocos de neve. */
const GROUND: Record<Biome, string> = {
  campo: 'M30 48 l1.5 -3 l1.5 3 M86 50 l1.5 -3 l1.5 3 M60 54 l1.5 -3 l1.5 3',
  cerrado: 'M30 49 l1 -5 M33 49 l-1 -4 M86 51 l1 -5 M89 51 l-1 -4',
  neve: 'M29 47 h4 M31 45 v4 M85 49 h4 M87 47 v4',
}

export function IslandIcon({ color, biome, empty = false }: IslandIconProps) {
  return (
    <svg viewBox="0 0 120 90" aria-hidden="true" fill="none" stroke="#2a2823" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
      {/* terra embaixo, rasa e facetada, com hachuras */}
      <path d="M10 46 L22 62 L44 74 L60 78 L76 74 L98 62 L110 46" />
      <path d="M28 56 L44 74 M60 60 L60 78 M92 56 L76 74" strokeWidth="0.8" />
      <path d="M24 58 L30 64 M36 64 L40 70 M50 66 L52 72 M68 66 L66 72 M82 62 L78 68 M96 58 L90 64" strokeWidth="0.6" opacity="0.55" />
      {/* topo */}
      <path d="M10 46 L28 36 L60 32 L92 36 L110 46 L92 56 L60 60 L28 56 Z" fill="#f8f4ea" />
      <path d={GROUND[biome]} strokeWidth="0.9" />
      {!empty && (
        <g>
          {/* árvore de copa redonda */}
          <path d="M48 50 V38" strokeWidth="1.6" />
          <path d="M40 36 a6 6 0 0 1 4 -9 a6.5 6.5 0 0 1 11 1 a5.5 5.5 0 0 1 1 9 Z" fill={color} fillOpacity="0.55" />
          {/* pinheirinho */}
          <path d="M74 52 V46" strokeWidth="1.6" />
          <path d="M74 24 L66 38 L70 38 L64 47 L84 47 L78 38 L82 38 Z" fill={color} fillOpacity="0.3" />
        </g>
      )}
    </svg>
  )
}
