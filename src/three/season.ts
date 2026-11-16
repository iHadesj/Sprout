// A estação do ano, pela data de quem está olhando.
//
// Hemisfério sul (o app é brasileiro): dezembro é verão, junho é inverno. As datas são as
// convencionais dos solstícios e equinócios, sem a precisão astronômica (que varia horas de
// um ano pro outro e não muda nada no desenho).
//
// É só aparência: muda a cor da copa, as folhas que caem e um empurrãozinho na luz. Nada aqui
// mexe em sessão, crescimento ou histórico — trocar de estação não apaga nem cria planta.
//
// A copa é tingida no shader (multiplicando a cor das partes com folha), em vez de reconstruir
// a árvore: assim vale pra todas as espécies de uma vez e não custa geometria nova.

export type Season = 'primavera' | 'verao' | 'outono' | 'inverno'

export interface SeasonLook {
  label: string
  /**
   * A cor que uma folha de brilho médio vira nesta estação, já dividida pelo brilho — por isso
   * os números passam de 1. No shader é o brilho da folha vezes isto, então a copa troca de
   * cor de verdade (só multiplicar a cor original não tirava o verde do verde).
   */
  tint: [number, number, number]
  /** quanto do tingimento entra (0 a 1) */
  tintAmount: number
  /** o mesmo na grama, mais fraco: o chão não vira a mesma coisa que a árvore */
  grassAmount: number
  /** cores das folhas que caem */
  leafColors: string[]
  /** quantas folhas no ar ao mesmo tempo */
  leafCount: number
  /** empurrão na luz: >0 esquenta (outono), <0 esfria (inverno) */
  warmth: number
}

const LOOKS: Record<Season, SeasonLook> = {
  primavera: {
    label: 'Primavera',
    tint: [1.49, 2.06, 0.8],
    tintAmount: 0.38,
    grassAmount: 0.26,
    // pétalas no ar, mais do que folha
    leafColors: ['#f7c9d8', '#fdeef2', '#c7e2a0', '#f3b7cd', '#ffffff', '#a9cf76'],
    leafCount: 10,
    warmth: 0.1,
  },
  verao: {
    label: 'Verão',
    tint: [0.63, 1.31, 0.51],
    tintAmount: 0.22,
    grassAmount: 0.16,
    leafColors: ['#3f7f3a', '#5f9a45', '#71ad4f', '#86b85d'],
    leafCount: 5,
    warmth: 0.18,
  },
  outono: {
    label: 'Outono',
    tint: [2.23, 1.03, 0.34],
    tintAmount: 0.62,
    grassAmount: 0.4,
    leafColors: ['#c96a2b', '#e0953c', '#b4452c', '#d9b14a', '#8c5a2b', '#e8c06a'],
    leafCount: 16,
    warmth: 0.22,
  },
  inverno: {
    label: 'Inverno',
    tint: [1.2, 1.43, 1.46],
    tintAmount: 0.5,
    grassAmount: 0.45,
    leafColors: ['#8c9a7d', '#b3a98e', '#6f7f6a', '#c6bda6'],
    leafCount: 4,
    warmth: -0.25,
  },
}

/** Começo de cada estação no hemisfério sul: [mês (1–12), dia]. */
const STARTS: [Season, number, number][] = [
  ['verao', 12, 21],
  ['primavera', 9, 23],
  ['inverno', 6, 21],
  ['outono', 3, 21],
]

/** A estação naquela data. Antes de 21 de março ainda é o verão que começou em dezembro. */
export function seasonOf(date: Date = new Date()): Season {
  const month = date.getMonth() + 1
  const day = date.getDate()
  for (const [season, m, d] of STARTS) {
    if (month > m || (month === m && day >= d)) return season
  }
  return 'verao'
}

export function seasonLook(season: Season): SeasonLook {
  return LOOKS[season]
}

export const SEASONS = Object.keys(LOOKS) as Season[]
