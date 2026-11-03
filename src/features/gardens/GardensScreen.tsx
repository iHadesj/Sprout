// Página principal do caderno, de cima pra baixo:
// - registro do dia (data, foco de hoje, sequência e a semana em carimbos);
// - prancha em destaque: o último jardim aberto, com a ilha 3D e o "Focar agora";
// - índice: um jardim por área da vida, cada um uma "prancha" numerada.
// Sem jardins, mostra a página de rosto com as instruções de uso.
import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { PlusIcon } from '../../components/icons/plus'
import { Link, useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import type { Plant } from '../../lib/api'
import { fadeUp, stagger } from '../../lib/motion'
import { toast } from '../../lib/toast'
import { useNow } from '../../lib/useNow'
import { formatMinutes, honestySeal, isNeglected } from '../stats/insights'
import { useGardenStats } from '../stats/queries'
import { FeaturedGarden } from './FeaturedGarden'
import { biomeOf } from './gardenOptions'
import { GardenForm } from './GardenForm'
import { IslandIcon } from './IslandIcon'
import { lastGardenId } from './lastGarden'
import { speciesName, STAGE_LABEL, stageOf, summarizePlants } from './plants'
import { useCreateGarden, useGardens, usePlants } from './queries'
import { GiftNote } from '../friends/ReceivedGifts'
import { useReceivedGifts } from '../friends/useReceivedGifts'
import { TodayRecord } from './TodayRecord'
import styles from './GardensScreen.module.css'

const STEPS = [
  ['Plante', 'Comece um foco (25 min, por padrão). Não tem pausa: só dá pra desistir.'],
  ['Faça', 'Pode trabalhar em outros apps; só não feche a aba. Desistir mata a árvore da vez.'],
  ['Conte a verdade', 'No fim, diga se focou de verdade. Umas 5 sessões honestas fazem uma árvore adulta.'],
]

export function GardensScreen() {
  const gardens = useGardens()
  const plants = usePlants()
  const stats = useGardenStats()
  const now = useNow(60_000, true, Date.now)
  const create = useCreateGarden()
  const navigate = useNavigate()
  const received = useReceivedGifts()
  const [creating, setCreating] = useState(false)

  const plantsByGarden = useMemo(() => {
    const map = new Map<string, Plant[]>()
    for (const p of plants.data ?? []) map.set(p.garden_id, [...(map.get(p.garden_id) ?? []), p])
    return map
  }, [plants.data])

  const empty = gardens.data?.length === 0
  const neglectedOf = (garden: { id: string; created_at: string }) =>
    stats.isSuccess && isNeglected(stats.data.find((s) => s.garden_id === garden.id)?.last_completed_at ?? null, garden.created_at, now)

  // destaque: o último jardim aberto; se não houver, o da sessão concluída mais recente
  const featured = useMemo(() => {
    const list = gardens.data ?? []
    if (list.length === 0) return null
    const remembered = list.find((g) => g.id === lastGardenId())
    if (remembered) return { garden: remembered, remembered: true }
    const last = (id: string) => Date.parse(stats.data?.find((s) => s.garden_id === id)?.last_completed_at ?? '') || 0
    const recent = [...list].sort((a, b) => last(b.id) - last(a.id))[0]
    return { garden: recent, remembered: false }
  }, [gardens.data, stats.data])

  return (
    <motion.div className={styles.page} variants={stagger(0.05)} initial="hidden" animate="show">
      {gardens.isPending && <p className={styles.muted}>Abrindo o caderno…</p>}
      {gardens.isError && (
        <p className={styles.error} role="alert">
          Não deu pra carregar seus jardins: {gardens.error.message}
        </p>
      )}

      {empty && (
        <motion.section className={styles.cover} variants={fadeUp}>
          <div className={styles.coverArt}>
            <IslandIcon color="#f08fb0" biome="campo" />
          </div>
          <div className={styles.coverText}>
            <p className="kicker">Página de rosto</p>
            <h1>Comece pelo primeiro jardim</h1>
            <p className={styles.lead}>
              Este caderno guarda um jardim pra cada área da vida, como faculdade, treino ou inglês. Cada foco honesto faz uma
              árvore crescer; cada desistência fica registrada também.
            </p>
            <p className="kicker">Instruções de uso</p>
            <ol className={styles.steps}>
              {STEPS.map(([title, text], i) => (
                <li key={title}>
                  <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <strong>{title}.</strong> {text}
                  </span>
                </li>
              ))}
            </ol>
            <Button size="lg" icon={<PlusIcon size={18} strokeWidth={1.6} />} onClick={() => setCreating(true)}>
              Criar jardim
            </Button>
          </div>
        </motion.section>
      )}

      {!!gardens.data?.length && (
        <>
          <TodayRecord />

          {received.lines.length > 0 && <GiftNote lines={received.lines} onReplay={received.replay} />}

          {featured && (
            <FeaturedGarden
              garden={featured.garden}
              number={gardens.data.indexOf(featured.garden) + 1}
              plants={plantsByGarden.get(featured.garden.id) ?? []}
              stats={stats.data?.find((s) => s.garden_id === featured.garden.id) ?? null}
              neglected={neglectedOf(featured.garden)}
              remembered={featured.remembered}
              gifts={received.show}
            />
          )}

          <motion.header className={styles.header} variants={fadeUp}>
            <h2>Índice</h2>
            <p className={styles.lead}>Um jardim por área da vida. Abra uma prancha pra cuidar dela.</p>
          </motion.header>

          <ol className={styles.index}>
            {gardens.data.map((garden, i) => {
              const list = plantsByGarden.get(garden.id) ?? []
              const { growing, grown, dead } = summarizePlants(list)
              const gardenStats = stats.data?.find((s) => s.garden_id === garden.id)
              const neglected = neglectedOf(garden)
              const seal = honestySeal(gardenStats?.honest_nos ?? 0)
              return (
                <motion.li key={garden.id} variants={fadeUp}>
                  <Link to={`/jardim/${garden.id}`} className={styles.entry}>
                    <span className={styles.art}>
                      <IslandIcon color={garden.color} biome={biomeOf(garden.biome)} empty={!growing && grown === 0} />
                    </span>
                    <span className={styles.entryMain}>
                      <span className="kicker">Prancha nº {i + 1}</span>
                      <span className={styles.name}>
                        <span className={styles.dot} style={{ background: garden.color }} aria-hidden="true" />
                        {garden.name}
                      </span>
                      <span className={styles.detail}>
                        {growing ? (
                          <>
                            Da vez: <em>{speciesName(growing)}</em> · {STAGE_LABEL[stageOf(growing.growth)]} ·{' '}
                            <span className="mono">{growing.growth} de 10</span>
                          </>
                        ) : (
                          'Sem árvore crescendo agora'
                        )}
                        {neglected && <span className={styles.note}> · folhas amarelando</span>}
                        {seal && <span className={styles.note}> · {seal.label}</span>}
                      </span>
                    </span>
                    <span className={styles.leader} aria-hidden="true" />
                    <span className={styles.count}>
                      <span className="mono">{grown + dead}</span>
                      <span className={styles.countLabel}>
                        {grown} adultas · {dead} secas · {formatMinutes(gardenStats?.minutes ?? 0)}
                      </span>
                    </span>
                  </Link>
                </motion.li>
              )
            })}
          </ol>

          <motion.div variants={fadeUp}>
            <Button variant="secondary" icon={<PlusIcon size={17} strokeWidth={1.6} />} onClick={() => setCreating(true)}>
              Novo jardim
            </Button>
          </motion.div>
        </>
      )}

      <Dialog open={creating} title="Novo jardim" onClose={() => setCreating(false)}>
        <GardenForm
          submitLabel="Criar jardim"
          busy={create.isPending}
          error={create.error?.message}
          onSubmit={(input) =>
            create.mutate(input, {
              onSuccess: (garden) => {
                setCreating(false)
                toast.success(`Jardim "${garden.name}" criado`)
                navigate(`/jardim/${garden.id}`)
              },
            })
          }
        />
      </Dialog>
    </motion.div>
  )
}
