// O palco do jardim: a cena 3D (carregada sob demanda) e, enquanto ela carrega, se o
// navegador não tiver WebGL ou se a cena quebrar, a ilhazinha em SVG. O resumo em texto fica
// escondido na tela mas disponível pra leitor de tela, já que a cena 3D não tem como ser lida.
import { lazy, Suspense } from 'react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import type { Garden, GardenFlower, Plant } from '../../lib/api'
import { useFocusStore } from '../../stores/focusStore'
import type { GiftShow } from '../../three/GiftEffects'
import { useProfile } from '../account/queries'
import { isHers } from '../surprise/surprise'
import type { HonestySeal } from '../stats/insights'
import { biomeOf } from './gardenOptions'
import { IslandIcon } from './IslandIcon'
import { describeGrowing, summarizePlants } from './plants'
import styles from './GardenLayout.module.css'

const GardenScene = lazy(() => import('../../three/GardenScene'))

interface GardenStageProps {
  garden: Garden
  plants: Plant[]
  neglected: boolean
  seal: HonestySeal | null
  /** no índice: cena menor, sem zoom pela roda do mouse */
  compact?: boolean
  gifts?: GiftShow | null
  /** jardim de um amigo */
  visiting?: boolean
  /** flores que amigos plantaram */
  flowers?: GardenFlower[]
  /** corações saindo ao vivo (visita) */
  liveHearts?: number
  /** nome de usuário do dono (visita); sem isso, o jardim é seu */
  owner?: string | null
}

export function GardenStage({ garden, plants, neglected, seal, compact = false, gifts = null, visiting = false, flowers, liveHearts, owner }: GardenStageProps) {
  const profile = useProfile()
  // a árvore velha da surpresa: só nos jardins da conta dela (dela vendo, ou alguém visitando)
  const oldTree = isHers(visiting ? owner : profile.data?.username)
  const focusMode = useFocusStore((s) => s.timer.phase === 'focus' || s.timer.phase === 'review')
  const { growing, grown, dead } = summarizePlants(plants)
  const placeholder = (
    <div className={styles.placeholder}>
      <IslandIcon color={garden.color} biome={biomeOf(garden.biome)} empty={!growing} />
    </div>
  )

  return (
    <div className={styles.sceneBox} data-growing-growth={growing?.growth ?? ''}>
      <ErrorBoundary fallback={placeholder}>
        <Suspense fallback={placeholder}>
          <GardenScene
            garden={garden}
            plants={plants}
            focusMode={focusMode}
            neglected={neglected}
            sealLevel={seal?.level ?? 0}
            fallback={placeholder}
            compact={compact}
            gifts={gifts}
            flowers={flowers}
            liveHearts={liveHearts}
            oldTree={oldTree}
          />
        </Suspense>
      </ErrorBoundary>
      <p className="visually-hidden" data-testid="garden-summary">
        {growing ? `Crescendo: ${describeGrowing(growing, garden.biome)}` : 'Nenhuma planta crescendo'}. {grown} adultas, {dead} secas.
        {neglected && ' Folhas amareladas: faz mais de 3 dias sem foco aqui.'}
        {seal && ` ${seal.label}.`}
      </p>
    </div>
  )
}
