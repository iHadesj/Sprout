// Peças soltas da página principal (o centro é o FocusLauncher):
// - "hoje" (minutos) e "sequência" (dias seguidos + a semana em bolinhas num arco), em pedrinhas;
// - a lista de jardins, sem linhas nem caixas: cada um leva pra página dele.
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { ChevronRightIcon } from '../../components/icons/chevron-right'
import { PlusIcon } from '../../components/icons/plus'
import { Button } from '../../components/Button'
import { arc } from '../../components/organic/curve'
import { Drift } from '../../components/organic/Drift'
import { Pebble } from '../../components/organic/Pebble'
import type { Garden, Plant } from '../../lib/api'
import { fromSide, hoverTilt } from '../../lib/motion'
import { useNow } from '../../lib/useNow'
import { useProfile } from '../account/queries'
import { addDays, formatMinutes, lastDays, todayIn } from '../stats/insights'
import { useFocusDays, useStreaks } from '../stats/queries'
import { summarizePlants } from './plants'
import styles from './HomeBlocks.module.css'

/** Sessões por dia que fazem a planta crescer (a regra mora no banco; aqui é só o texto). */
const DAILY_LIMIT = 10

/** Os últimos 7 dias, a partir das views do banco (no fuso da pessoa). */
function useWeek() {
  const profile = useProfile()
  const timeZone = profile.data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  // o relógio anda de minuto em minuto: à meia-noite o "hoje" vira sozinho
  const clock = useNow(60_000, true, Date.now)
  const today = todayIn(timeZone, clock)
  const focusDays = useFocusDays(addDays(today, -6))
  return { today, week: lastDays(focusDays.data ?? [], today, 7) }
}

export function TodayPebble() {
  const { week } = useWeek()
  const today = week[week.length - 1]
  return (
    <Pebble value={formatMinutes(today.minutes)} label="de foco hoje" size="lg" float={4.2}>
      <span className={styles.small}>
        <span className="mono">
          {today.sessions} de {DAILY_LIMIT}
        </span>{' '}
        {today.sessions >= DAILY_LIMIT ? 'limite do dia' : 'sessões'}
      </span>
    </Pebble>
  )
}

export function StreakPebble() {
  const { today, week } = useWeek()
  const streaks = useStreaks()
  const streak = streaks.data?.current_streak ?? 0
  return (
    <Pebble value={String(streak)} label={streak === 1 ? 'dia seguido' : 'dias seguidos'} size="lg" float={5.1} style={{ animationDelay: '-1.3s' }}>
      <ol className={styles.week} aria-label="Foco nos últimos 7 dias">
        {week.map((day, i) => {
          const done = day.sessions > 0
          const isToday = day.day === today
          const { lift } = arc(i, week.length, 7, 0)
          return (
            <li key={day.day} className={styles.day} style={{ translate: `0 ${lift}px` }} data-today={isToday || undefined} data-done={done || undefined}>
              <span className="visually-hidden">
                {isToday ? 'hoje' : day.day}: {done ? `${formatMinutes(day.minutes)} de foco` : 'sem foco'}
              </span>
            </li>
          )
        })}
      </ol>
    </Pebble>
  )
}

interface GardenListProps {
  gardens: Garden[]
  plantsByGarden: Map<string, Plant[]>
  isNeglected: (garden: Garden) => boolean
  onCreate: () => void
}

export function GardenList({ gardens, plantsByGarden, isNeglected, onCreate }: GardenListProps) {
  return (
    <>
      <Drift as="ul" className={styles.gardens}>
        {gardens.map((garden, i) => {
          const { growing, grown } = summarizePlants(plantsByGarden.get(garden.id) ?? [])
          return (
            <motion.li key={garden.id} variants={fromSide} custom={-1} whileHover={hoverTilt(i)}>
              <Link to={`/jardim/${garden.id}`} className={styles.garden}>
                <span className={styles.dot} style={{ background: garden.color }} aria-hidden="true" />
                <span className={styles.gardenText}>
                  <span className={styles.gardenName}>{garden.name}</span>
                  <span className={styles.gardenInfo}>
                    {growing ? <span className="mono">{growing.growth} de 10</span> : 'sem árvore'}
                    {grown > 0 && ` · ${grown} ${grown === 1 ? 'adulta' : 'adultas'}`}
                    {isNeglected(garden) && <span className={styles.warn}> · amarelando</span>}
                  </span>
                </span>
                <ChevronRightIcon size={18} />
              </Link>
            </motion.li>
          )
        })}
      </Drift>
      <div>
        <Button variant="quiet" icon={<PlusIcon size={16} />} onClick={onCreate}>
          Novo jardim
        </Button>
      </div>
    </>
  )
}
