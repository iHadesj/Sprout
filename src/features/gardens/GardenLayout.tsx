// Página de um jardim: à esquerda a ilha 3D grande, sem moldura, sobre uma mancha de papel e
// sangrando pra fora da coluna; à direita o painel (rota filha: visão geral ou foco), que
// segue a curva da ilha. A cena fica aqui e não remonta quando a pessoa vai da visão geral
// pro foco. No foco, a ilha ocupa a tela toda e a mancha para (nada se mexe em volta).
import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router'
import { AnimatedOutlet } from '../../components/AnimatedOutlet'
import { ButtonLink } from '../../components/Button'
import { Blob } from '../../components/organic/Blob'
import { useNow } from '../../lib/useNow'
import { useFocusStore } from '../../stores/focusStore'
import { honestySeal, isNeglected } from '../stats/insights'
import { useGardenStats } from '../stats/queries'
import type { GardenOutletContext } from './gardenContext'
import { useGardenFlowers } from '../friends/queries'
import { GardenStage } from './GardenStage'
import { rememberGarden } from './lastGarden'
import { useGarden, usePlants } from './queries'
import styles from './GardenLayout.module.css'

export function GardenLayout() {
  const { gardenId = '' } = useParams()
  const garden = useGarden(gardenId)
  const plants = usePlants(gardenId)
  const flowers = useGardenFlowers(gardenId)
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

  if (garden.isPending) return <p className={styles.status}>Abrindo o jardim…</p>
  if (garden.isError) {
    return (
      <div className={styles.status}>
        <p>Esse jardim não existe neste caderno.</p>
        <ButtonLink to="/" variant="secondary">
          Voltar ao início
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

  return (
    <div className={styles.page} data-immersive={immersive || undefined} data-withered={withered || undefined}>
      <figure className={styles.plate} aria-label={`Jardim ${garden.data.name}`}>
        <Blob className={styles.blob} still={immersive} />
        <div className={styles.frame}>
          <GardenStage garden={garden.data} plants={context.plants} neglected={context.neglected} seal={context.seal} flowers={flowers.data} />
        </div>
      </figure>
      <section className={styles.sheet}>
        <AnimatedOutlet routeKey={pathname} context={context} />
      </section>
    </div>
  )
}
