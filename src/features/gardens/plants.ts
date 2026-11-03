// Nomes e estágios das plantas pra mostrar na tela (a cena 3D usa os mesmos estágios).
// Só traduz o growth que veio do banco em palavras: nada aqui decide crescimento.
import type { Plant } from '../../lib/api'

export type Stage = 'semente' | 'broto' | 'muda' | 'jovem' | 'adulta'
export type Species = 'pinheiro' | 'macieira' | 'cerejeira'

export function stageOf(growth: number): Stage {
  if (growth <= 0) return 'semente'
  if (growth <= 3) return 'broto'
  if (growth <= 6) return 'muda'
  if (growth <= 9) return 'jovem'
  return 'adulta'
}

export const STAGE_LABEL: Record<Stage, string> = {
  semente: 'semente',
  broto: 'broto',
  muda: 'muda',
  jovem: 'árvore jovem',
  adulta: 'adulta',
}

export function speciesOf(plant: Pick<Plant, 'species'>): Species {
  return plant.species === 'pinheiro' || plant.species === 'cerejeira' ? plant.species : 'macieira'
}

export const SPECIES_LABEL: Record<Species, string> = {
  pinheiro: 'Pinheiro',
  macieira: 'Macieira',
  cerejeira: 'Cerejeira',
}

/** "Pinheiro" */
export function speciesName(plant: Pick<Plant, 'species'>): string {
  return SPECIES_LABEL[speciesOf(plant)]
}

export interface GardenPlantSummary {
  growing: Plant | null
  grown: number
  dead: number
}

export function summarizePlants(plants: Plant[]): GardenPlantSummary {
  return {
    growing: plants.find((p) => p.status === 'growing') ?? null,
    grown: plants.filter((p) => p.status === 'grown').length,
    dead: plants.filter((p) => p.status === 'dead').length,
  }
}

/** "Pinheiro · broto · 2 de 10" */
export function describeGrowing(plant: Plant): string {
  return `${speciesName(plant)} · ${STAGE_LABEL[stageOf(plant.growth)]} · ${plant.growth} de 10`
}
