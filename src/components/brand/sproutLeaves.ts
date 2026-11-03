// Quantas folhas o broto da marca mostra, a partir dos minutos de foco de hoje (que o banco já
// contou). É só tradução visual: não vale ponto nem muda nada no jardim.

/** Minutos de hoje a partir dos quais aparece a 1ª, a 2ª e a 3ª folha. */
export const LEAF_THRESHOLDS = [1, 50, 100] as const

export type LeafCount = 0 | 1 | 2 | 3

export function sproutLeaves(minutesToday: number): LeafCount {
  if (!Number.isFinite(minutesToday)) return 0
  return LEAF_THRESHOLDS.filter((min) => minutesToday >= min).length as LeafCount
}
