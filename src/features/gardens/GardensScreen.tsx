// Página principal, solta (sem blocos nem grade):
// - no centro, a ilha do jardim escolhido, com hoje e sequência em pedrinhas encostadas nela,
//   os jardins num arco e o "Começar foco" (um clique);
// - depois de uma onda, duas correntes de larguras diferentes: seus jardins e o mural.
// Presentes de amigos aparecem numa frase solta em cima e tocam na ilha.
// Sem jardins, mostra a página de rosto pra criar o primeiro.
import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Link, useNavigate } from 'react-router'
import { PlusIcon } from '../../components/icons/plus'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Blob } from '../../components/organic/Blob'
import { Wave } from '../../components/organic/Wave'
import type { Garden, Plant } from '../../lib/api'
import { fadeUp, stagger } from '../../lib/motion'
import { toast } from '../../lib/toast'
import { useNow } from '../../lib/useNow'
import { useGardenFlowers } from '../friends/queries'
import { Mural } from '../friends/Mural'
import { GiftNote } from '../friends/ReceivedGifts'
import { useReceivedGifts } from '../friends/useReceivedGifts'
import { honestySeal, isNeglected } from '../stats/insights'
import { useGardenStats } from '../stats/queries'
import { FocusLauncher } from './FocusLauncher'
import { GardenForm } from './GardenForm'
import { GardenList, StreakPebble, TodayPebble } from './HomeBlocks'
import { IslandIcon } from './IslandIcon'
import { lastGardenId, rememberGarden } from './lastGarden'
import { useCreateGarden, useGardens, usePlants } from './queries'
import styles from './GardensScreen.module.css'

export function GardensScreen() {
  const gardens = useGardens()
  const plants = usePlants()
  const stats = useGardenStats()
  const now = useNow(60_000, true, Date.now)
  const create = useCreateGarden()
  const navigate = useNavigate()
  const received = useReceivedGifts()
  const [creating, setCreating] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  const plantsByGarden = useMemo(() => {
    const map = new Map<string, Plant[]>()
    for (const p of plants.data ?? []) map.set(p.garden_id, [...(map.get(p.garden_id) ?? []), p])
    return map
  }, [plants.data])

  const statsOf = (id: string) => stats.data?.find((s) => s.garden_id === id) ?? null
  const neglectedOf = (garden: Garden) => stats.isSuccess && isNeglected(statsOf(garden.id)?.last_completed_at ?? null, garden.created_at, now)

  // jardim do bloco grande: o escolhido agora, senão o último aberto, senão o da sessão mais recente
  const selected = useMemo(() => {
    const list = gardens.data ?? []
    if (list.length === 0) return null
    const byId = (id: string | null) => list.find((g) => g.id === id)
    const last = (id: string) => Date.parse(stats.data?.find((s) => s.garden_id === id)?.last_completed_at ?? '') || 0
    return byId(picked) ?? byId(lastGardenId()) ?? [...list].sort((a, b) => last(b.id) - last(a.id))[0]
  }, [gardens.data, stats.data, picked])
  const flowers = useGardenFlowers(selected?.id ?? null)

  const select = (id: string) => {
    setPicked(id)
    rememberGarden(id)
  }

  const empty = gardens.data?.length === 0

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
            <Blob className={styles.coverBlob} />
            <IslandIcon color="#f08fb0" biome="campo" />
          </div>
          <h1>Plante o primeiro jardim</h1>
          <p className={styles.lead}>Um jardim pra cada área da vida. Cada foco honesto faz uma árvore crescer.</p>
          <Button size="lg" icon={<PlusIcon size={18} />} onClick={() => setCreating(true)}>
            Criar jardim
          </Button>
        </motion.section>
      )}

      {!!gardens.data?.length && selected && (
        <>
          {(received.lines.length > 0 || received.answered.length > 0) && (
            <GiftNote lines={received.lines} answered={received.answered} onReplay={received.replay} />
          )}

          <FocusLauncher
            gardens={gardens.data}
            garden={selected}
            plants={plantsByGarden.get(selected.id) ?? []}
            neglected={neglectedOf(selected)}
            seal={honestySeal(statsOf(selected.id)?.honest_nos ?? 0)}
            onSelect={select}
            gifts={received.show}
            flowers={flowers.data}
            today={<TodayPebble />}
            streak={<StreakPebble />}
          />

          <Wave className={styles.wave} />

          <div className={styles.streams}>
            <motion.section className={styles.gardensCol} variants={stagger(0.06)} aria-labelledby="seus-jardins">
              <h2 id="seus-jardins">Seus jardins</h2>
              <GardenList gardens={gardens.data} plantsByGarden={plantsByGarden} isNeglected={neglectedOf} onCreate={() => setCreating(true)} />
            </motion.section>
            <motion.section className={styles.muralCol} variants={fadeUp} aria-labelledby="mural">
              <h2 id="mural">Mural</h2>
              <Mural limit={4} emptyText="Quando você ou um amigo deixar uma árvore adulta, aparece aqui." />
              <Link to="/amigos" className={styles.more}>
                Ver amigos e o quadro da semana
              </Link>
            </motion.section>
          </div>
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
