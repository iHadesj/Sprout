// Nomes e estágios das plantas pra mostrar na tela (a cena 3D usa os mesmos estágios).
// Só traduz o growth que veio do banco em palavras: nada aqui decide crescimento.
//
// Espécie x aparência: o banco guarda só pinheiro, macieira ou cerejeira. Num jardim de
// neve, a mesma planta aparece como a "prima" de neve (abeto, bétula, sorveira). É só o
// desenho e o nome: a planta, o crescimento e o histórico são os mesmos, e trocar o bioma
// do jardim troca a aparência de todas as árvores dele.
import type { Plant } from '../../lib/api'

export type Stage = 'semente' | 'broto' | 'muda' | 'jovem' | 'adulta'
export type Species = 'pinheiro' | 'macieira' | 'cerejeira'
/** Como a árvore é desenhada e chamada: a espécie, ou a prima de neve dela. */
export type Look = Species | 'abeto' | 'betula' | 'sorveira'

const SNOW_LOOK: Record<Species, Look> = { pinheiro: 'abeto', macieira: 'betula', cerejeira: 'sorveira' }

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

/** A aparência da planta no bioma do jardim (neve troca pela prima de neve). */
export function lookOf(plant: Pick<Plant, 'species'>, biome?: string | null): Look {
  const species = speciesOf(plant)
  return biome === 'neve' ? SNOW_LOOK[species] : species
}

export const LOOK_LABEL: Record<Look, string> = {
  pinheiro: 'Pinheiro',
  macieira: 'Macieira',
  cerejeira: 'Cerejeira',
  abeto: 'Abeto',
  betula: 'Bétula',
  sorveira: 'Sorveira',
}

const MASCULINE = new Set<Look>(['pinheiro', 'abeto'])

/** "Pinheiro" (ou "Abeto", num jardim de neve) */
export function speciesName(plant: Pick<Plant, 'species'>, biome?: string | null): string {
  return LOOK_LABEL[lookOf(plant, biome)]
}

/** "um pinheiro adulto", "uma bétula adulta" */
export function adultName(plant: Pick<Plant, 'species'>, biome?: string | null): string {
  const look = lookOf(plant, biome)
  const name = LOOK_LABEL[look].toLowerCase()
  return MASCULINE.has(look) ? `um ${name} adulto` : `uma ${name} adulta`
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
export function describeGrowing(plant: Plant, biome?: string | null): string {
  return `${speciesName(plant, biome)} · ${STAGE_LABEL[stageOf(plant.growth)]} · ${plant.growth} de 10`
}
