// O "hoje" no fuso da pessoa e os últimos 7 dias de foco, a partir das views do banco.
// Usado pelas pedrinhas da página principal e pelo broto da marca no cabeçalho; a query é a
// mesma, então o react-query busca uma vez só.
import { useNow } from '../../lib/useNow'
import { useProfile } from '../account/queries'
import { addDays, lastDays, todayIn } from './insights'
import { useFocusDays } from './queries'

export function useToday() {
  const profile = useProfile()
  const timeZone = profile.data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  // o relógio anda de minuto em minuto: à meia-noite o "hoje" vira sozinho
  const clock = useNow(60_000, true, Date.now)
  const today = todayIn(timeZone, clock)
  const focusDays = useFocusDays(addDays(today, -6))
  const week = lastDays(focusDays.data ?? [], today, 7)
  return { today, week, todayMinutes: week[week.length - 1].minutes, timeZone, clock }
}
