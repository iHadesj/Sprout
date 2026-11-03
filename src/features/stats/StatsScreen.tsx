// Estatísticas: sequência de dias, tempo de foco, honestidade e o que distrai.
// Todos os números vêm das views do banco (supabase/migrations/..._estatisticas.sql).
import { useMemo } from 'react'
import { motion } from 'motion/react'
import { fadeUp, stagger } from '../../lib/motion'
import { ButtonLink } from '../../components/Button'
import { useProfile } from '../account/queries'
import { DISTRACTION_OPTIONS } from '../focus/labels'
import { useGardens } from '../gardens/queries'
import { BarTable, DailyBars, StatTile, type BarRow } from './charts'
import { addDays, distractionInsight, formatMinutes, lastDays, todayIn } from './insights'
import { useDistractions, useFocusDays, useGardenStats, useStreaks } from './queries'
import styles from './StatsScreen.module.css'

const DAYS = 14

export function StatsScreen() {
  const profile = useProfile()
  const timezone = profile.data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = todayIn(timezone)
  const gardens = useGardens()
  const gardenStats = useGardenStats()
  const focusDays = useFocusDays(addDays(today, -(DAYS - 1)))
  const streaks = useStreaks()
  const distractions = useDistractions()

  const totals = useMemo(() => {
    const rows = gardenStats.data ?? []
    return {
      minutes: rows.reduce((sum, r) => sum + (r.minutes ?? 0), 0),
      completed: rows.reduce((sum, r) => sum + (r.completed ?? 0), 0),
      honestNos: rows.reduce((sum, r) => sum + (r.honest_nos ?? 0), 0),
    }
  }, [gardenStats.data])

  const gardenRows: BarRow[] = useMemo(() => {
    const statsById = new Map((gardenStats.data ?? []).map((s) => [s.garden_id, s]))
    return (gardens.data ?? [])
      .map((garden) => {
        const s = statsById.get(garden.id)
        const done = s?.completed ?? 0
        const failed = s?.failed ?? 0
        return {
          key: garden.id,
          label: garden.name,
          swatch: garden.color,
          value: s?.minutes ?? 0,
          display: formatMinutes(s?.minutes ?? 0),
          detail: `${done} ${done === 1 ? 'concluída' : 'concluídas'}${failed ? ` · ${failed} ${failed === 1 ? 'falhou' : 'falharam'}` : ''}`,
        }
      })
      .sort((a, b) => b.value - a.value)
  }, [gardens.data, gardenStats.data])

  const distractionRows: BarRow[] = useMemo(() => {
    const byTag = new Map<string, number>()
    for (const r of distractions.data ?? []) if (r.tag) byTag.set(r.tag, (byTag.get(r.tag) ?? 0) + (r.count ?? 0))
    return DISTRACTION_OPTIONS.filter((o) => byTag.has(o.value))
      .map((o) => {
        const count = byTag.get(o.value) ?? 0
        return { key: o.value, label: o.label, value: count, display: `${count}×` }
      })
      .sort((a, b) => b.value - a.value)
  }, [distractions.data])

  const loading = gardenStats.isPending || focusDays.isPending || streaks.isPending
  const insight = distractionInsight(distractions.data ?? [])

  return (
    <motion.div className={styles.page} variants={stagger(0.08)} initial="hidden" animate="show">
      <motion.header className={styles.header} variants={fadeUp}>
        <p className="kicker">Diário de campo</p>
        <h1>
          Seu <em>ritmo</em>
        </h1>
        <p>Só conta o que o servidor validou. Sessão perdida ou inválida não entra no tempo de foco.</p>
      </motion.header>

      {loading ? (
        <motion.p className={styles.muted} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
          Somando as horas…
        </motion.p>
      ) : totals.completed === 0 && totals.honestNos === 0 ? (
        <motion.section className={styles.empty} variants={fadeUp}>
          <h2>Ainda não tem nada pra medir</h2>
          <p>Termine a primeira sessão de foco e os números aparecem aqui.</p>
          <ButtonLink to="/">Ir pro índice</ButtonLink>
        </motion.section>
      ) : (
        <>
          <motion.section className={styles.tiles} aria-label="Resumo" variants={stagger(0.07)}>
            <StatTile
              label="Sequência atual"
              value={streaks.data?.current_streak ?? 0}
              format={(n) => plural(n, 'dia', 'dias')}
              detail="dias seguidos com foco concluído"
            />
            <StatTile
              label="Melhor sequência"
              value={streaks.data?.best_streak ?? 0}
              format={(n) => plural(n, 'dia', 'dias')}
            />
            <StatTile
              label="Tempo de foco"
              value={totals.minutes}
              format={formatMinutes}
              detail={plural(totals.completed, 'sessão', 'sessões')}
            />
            <StatTile
              label="Sinceridade"
              value={totals.honestNos}
              detail="vezes que você admitiu não ter focado"
            />
          </motion.section>

          <motion.section className={styles.card} variants={fadeUp}>
            <h2>Minutos de foco por dia</h2>
            <p className={styles.cardHint}>Últimos {DAYS} dias</p>
            <DailyBars days={lastDays(focusDays.data ?? [], today, DAYS)} />
          </motion.section>

          <motion.section className={styles.card} variants={fadeUp}>
            <h2>Tempo por jardim</h2>
            <BarTable caption="Tempo de foco por jardim" valueHeader="Tempo de foco" rows={gardenRows} />
          </motion.section>

          <motion.section className={styles.card} variants={fadeUp}>
            <h2>O que distrai</h2>
            {distractionRows.length === 0 ? (
              <p className={styles.cardHint}>
                Quando você responder "mais ou menos" ou "não" na revisão, marque o que distraiu. Aparece aqui.
              </p>
            ) : (
              <>
                {insight && (
                  <motion.p
                    className={styles.insight}
                    initial={{ clipPath: 'inset(0 100% 0 0)' }}
                    animate={{ clipPath: 'inset(0 0% 0 0)' }}
                    transition={{ duration: 1.1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {insight}
                  </motion.p>
                )}
                <BarTable caption="Distrações marcadas" valueHeader="Vezes" rows={distractionRows} />
              </>
            )}
          </motion.section>
        </>
      )}
    </motion.div>
  )
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}
