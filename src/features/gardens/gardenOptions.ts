// Opções de cor e bioma de um jardim. A cor pinta as flores e a ilha na cena 3D.

export const GARDEN_COLORS = [
  { value: '#f08fb0', label: 'Rosa' },
  { value: '#f2c14e', label: 'Amarelo' },
  { value: '#b49af0', label: 'Lilás' },
  { value: '#f4876b', label: 'Coral' },
  { value: '#7fb4f0', label: 'Azul' },
  { value: '#6fcfb6', label: 'Verde-água' },
  { value: '#f5a35c', label: 'Laranja' },
  { value: '#e5677a', label: 'Vermelho' },
] as const

export type Biome = 'campo' | 'cerrado' | 'neve'

export const BIOMES: { value: Biome; label: string; hint: string }[] = [
  { value: 'campo', label: 'Campo', hint: 'grama verde' },
  { value: 'cerrado', label: 'Cerrado', hint: 'capim dourado' },
  { value: 'neve', label: 'Neve', hint: 'chão branco' },
]

export function biomeOf(value: string): Biome {
  return value === 'cerrado' || value === 'neve' ? value : 'campo'
}
