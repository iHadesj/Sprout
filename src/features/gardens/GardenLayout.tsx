// Página dupla de um jardim: à esquerda a "prancha" (a ilha 3D emoldurada, com legenda),
// à direita a ficha (rota filha: visão geral ou foco). A cena fica aqui e não remonta
// quando a pessoa vai da visão geral pro foco. No foco, a prancha ocupa a página toda.
import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router'
import { AnimatedOutlet } from '../../components/AnimatedOutlet'
import { ButtonLink } from '../../components/Button'
import { useNow } from '../../lib/useNow'
import { useFocusStore } from '../../stores/focusStore'
import { honestySeal, isNeglected } from '../stats/insights'
import { useGardenStats } from '../stats/queries'
import type { GardenOutletContext } from './gardenContext'
import { BIOMES, biomeOf } from './gardenOptions'
import { GardenStage } from './GardenStage'
import { rememberGarden } from './lastGarden'
import { useGarden, useGardens, usePlants } from './queries'
import styles from './GardenLayout.module.css'

export function GardenLayout() {
  const { gardenId = '' } = useParams()
  const garden = useGarden(gardenId)
  const gardens = useGardens()
  const plants = usePlants(gardenId)
  const stats = useGardenStats()
  const now = useNow(60_000, true, Date.now)
  const { pathname } = useLocation()
  // foco e revisão: a cena ocupa a tela toda, atrás da ficha (modo imersivo)
  const immersive = useFocusStore((s) => s.timer.phase === 'focus' || s.timer.phase === 'review')
  const withered = useFocusStore((s) => s.timer.phase === 'failed')
  // o índice destaca o último jardim aberto
  const loaded = garden.isSuccess
  useEffect(() => {
    if (loaded) rememberGarden(gardenId)
  }, [loaded, gardenId])

  if (garden.isPending) return <p className={styles.status}>Abrindo a prancha…</p>
  if (garden.isError) {
    return (
      <div className={styles.status}>
        <p>Essa prancha não existe neste caderno.</p>
        <ButtonLink to="/" variant="secondary">
          Voltar ao índice
        </ButtonLink>
      </div>
    )
  }

  const gardenStats = stats.data?.find((s) => s.garden_id === gardenId) ?? null
  const context: GardenOutletContext = {
    garden: garden.data,
    plants: plants.data ?? [],
    stats: gardenStats,
    // enquanto as estatísticas carregam, não amarela à toa
    neglected: stats.isSuccess && isNeglected(gardenStats?.last_completed_at ?? null, garden.data.created_at, now),
    seal: honestySeal(gardenStats?.honest_nos ?? 0),
  }
  const number = (gardens.data?.findIndex((g) => g.id === gardenId) ?? -1) + 1
  const biome = BIOMES.find((b) => b.value === biomeOf(garden.data.biome))?.label.toLowerCase()
  const specimens = context.plants.length

  return (
    <div className={styles.page} data-immersive={immersive || undefined} data-withered={withered || undefined}>
      <figure className={styles.plate} aria-label={`Jardim ${garden.data.name}`}>
        <div className={styles.frame}>
          <GardenStage garden={garden.data} plants={context.plants} neglected={context.neglected} seal={context.seal} />
        </div>
        <figcaption className={styles.caption}>
          <span className="kicker">{number > 0 ? `Prancha nº ${number}` : 'Prancha'}</span>
          <em>
            fig. 1 — ilha de {biome}, {specimens} {specimens === 1 ? 'espécime' : 'espécimes'}
          </em>
        </figcaption>
      </figure>
      <section className={styles.sheet}>
        <AnimatedOutlet routeKey={pathname} context={context} />
      </section>
    </div>
  )
}
