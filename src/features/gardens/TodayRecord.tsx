// Registro do dia, no topo do índice: a data como entrada de diário, o que já foi feito
// hoje (das views de estatística do banco) e a semana em carimbos, um por dia com foco.
import { motion } from 'motion/react'
import { fadeUp, stagger } from '../../lib/motion'
import { useNow } from '../../lib/useNow'
import { useProfile } from '../account/queries'
import { addDays, formatMinutes, lastDays, todayIn } from '../stats/insights'
import { useFocusDays, useStreaks } from '../stats/queries'
import styles from './TodayRecord.module.css'

/** Sessões por dia que fazem a planta crescer (a regra mora no banco; aqui é só o texto). */
const DAILY_LIMIT = 10

export function TodayRecord() {
  const profile = useProfile()
  const timeZone = profile.data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  // o relógio anda de minuto em minuto: à meia-noite a data e a semana viram sozinhas
  const clock = useNow(60_000, true, Date.now)
  const today = todayIn(timeZone, clock)
  const focusDays = useFocusDays(addDays(today, -6))
  const streaks = useStreaks()

  const week = lastDays(focusDays.data ?? [], today, 7)
  const todayPoint = week[week.length - 1]
  const streak = streaks.data?.current_streak ?? 0
  const date = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(clock)

  const entries = [
    { value: formatMinutes(todayPoint.minutes), label: 'de foco hoje' },
    {
      value: `${todayPoint.sessions} de ${DAILY_LIMIT}`,
      label: todayPoint.sessions >= DAILY_LIMIT ? 'limite do dia atingido' : 'sessões que fazem crescer',
    },
    { value: String(streak), label: streak === 1 ? 'dia seguido' : 'dias seguidos' },
  ]

  return (
    <motion.section className={styles.record} variants={stagger(0.06)} initial="hidden" animate="show" aria-labelledby="today-title">
      <motion.header className={styles.head} variants={fadeUp}>
        <p className="kicker">Registro do dia</p>
        <h1 id="today-title" className={styles.date}>
          {date.charAt(0).toUpperCase() + date.slice(1)}
        </h1>
      </motion.header>

      <motion.dl className={styles.entries} variants={fadeUp}>
        {entries.map((entry) => (
          <div key={entry.label} className={styles.entry}>
            <dd className={`mono ${styles.value}`}>{entry.value}</dd>
            <dt className={styles.entryLabel}>{entry.label}</dt>
          </div>
        ))}
      </motion.dl>

      <motion.ol className={styles.week} variants={fadeUp} aria-label="Foco nos últimos 7 dias">
        {week.map((day) => {
          const done = day.sessions > 0
          const isToday = day.day === today
          const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day.day}T12:00:00Z`))
          return (
            <li key={day.day} className={styles.day} data-today={isToday || undefined}>
              <span className={styles.weekday}>{isToday ? 'hoje' : weekday.replace('.', '')}</span>
              <span className={styles.mark} data-done={done || undefined} title={done ? formatMinutes(day.minutes) : 'sem foco'}>
                {done && <span className="mono">{day.minutes}</span>}
              </span>
              <span className="visually-hidden">{done ? `${formatMinutes(day.minutes)} de foco` : 'sem foco'}</span>
            </li>
          )
        })}
      </motion.ol>
    </motion.section>
  )
}
