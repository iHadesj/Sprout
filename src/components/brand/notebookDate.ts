// A data no canto do cabeçalho, como no topo de uma página de diário: "ter · 03 nov".

export function formatNotebookDate(now: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'short', day: '2-digit', month: 'short' }).formatToParts(now)
  // o pt-BR abrevia com ponto ("ter.", "nov."); no caderno fica sem
  const part = (type: Intl.DateTimeFormatPartTypes) => (parts.find((p) => p.type === type)?.value ?? '').replace('.', '').toLowerCase()
  return `${part('weekday')} · ${part('day')} ${part('month')}`
}
