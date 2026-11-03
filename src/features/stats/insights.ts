// Traduções de estatística em texto e estado visual. Funções puras: os números vêm das
// views do banco; aqui só se decide como mostrar (nada de recompensa é calculado no front).
import type { DistractionStat, FocusDay } from '../../lib/api'

/** 3 dias sem sessão concluída: as folhas do jardim amarelam. */
export const NEGLECT_MS = 3 * 24 * 60 * 60 * 1000

/** Esquecido = sem sessão concluída (ou sem nada desde que o jardim foi criado) há mais de 3 dias. */
export function isNeglected(lastCompletedAt: string | null, createdAt: string, now: number): boolean {
  const last = Math.max(Date.parse(createdAt), lastCompletedAt ? Date.parse(lastCompletedAt) : 0)
  return now - last > NEGLECT_MS
}

export interface HonestySeal {
  level: 1 | 2 | 3
  label: string
}

/** Cada "não" assumido soma na sequência de honestidade, que vira selo no jardim. */
export function honestySeal(honestNos: number): HonestySeal | null {
  if (honestNos >= 15) return { level: 3, label: 'Honestidade de ferro' }
  if (honestNos >= 5) return { level: 2, label: 'Selo de honestidade' }
  if (honestNos >= 1) return { level: 1, label: 'Primeira sinceridade' }
  return null
}

/** "AAAA-MM-DD" de hoje num fuso horário. */
export function todayIn(timeZone: string, now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Soma (ou subtrai) dias numa data "AAAA-MM-DD", sem fuso no meio do caminho. */
export function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

export interface DayPoint {
  day: string
  minutes: number
  sessions: number
}

/** Os últimos `count` dias até `today`, com zero nos dias sem foco. */
export function lastDays(rows: FocusDay[], today: string, count: number): DayPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r]))
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(today, i - count + 1)
    const row = byDay.get(day)
    return { day, minutes: row?.minutes ?? 0, sessions: row?.sessions ?? 0 }
  })
}

/** 95 -> "1 h 35 min"; 40 -> "40 min"; 120 -> "2 h". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

const TAG_SENTENCE: Record<string, string> = {
  celular: 'O celular é o que mais te distrai',
  cansaco: 'O cansaço é o que mais te atrapalha',
  barulho: 'O barulho é o que mais te atrapalha',
  fome: 'A fome é o que mais te atrapalha',
  outro: 'Outras coisas são o que mais te distrai',
}

const PERIODS = [
  { from: 0, to: 5, label: 'de madrugada' },
  { from: 6, to: 11, label: 'de manhã' },
  { from: 12, to: 17, label: 'à tarde' },
  { from: 18, to: 21, label: 'à noite' },
  { from: 22, to: 23, label: 'depois das 22h' },
]

/** Uma frase útil sobre as distrações, ou null se ainda tem pouco dado (menos de 3 marcações). */
export function distractionInsight(rows: DistractionStat[]): string | null {
  const total = rows.reduce((sum, r) => sum + (r.count ?? 0), 0)
  if (total < 3) return null

  const byTag = new Map<string, number>()
  for (const r of rows) if (r.tag) byTag.set(r.tag, (byTag.get(r.tag) ?? 0) + (r.count ?? 0))
  const [topTag, topCount] = [...byTag.entries()].sort((a, b) => b[1] - a[1])[0]

  const byPeriod = PERIODS.map((p) => ({
    label: p.label,
    count: rows
      .filter((r) => r.tag === topTag && r.hour !== null && r.hour >= p.from && r.hour <= p.to)
      .reduce((sum, r) => sum + (r.count ?? 0), 0),
  })).sort((a, b) => b.count - a.count)[0]

  const sentence = TAG_SENTENCE[topTag] ?? TAG_SENTENCE.outro
  // só fala do horário se ele concentra pelo menos metade das vezes
  return byPeriod.count >= 2 && byPeriod.count * 2 >= topCount ? `${sentence}, principalmente ${byPeriod.label}.` : `${sentence}.`
}
