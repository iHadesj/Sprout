// Prancha em destaque no índice: o jardim aberto por último, com a ilha 3D de verdade e o
// "Focar agora" a um clique. Só esta prancha tem cena 3D (uma por página, pra não pesar).
import { motion } from 'motion/react'
import { Play } from 'lucide-react'
import { ButtonLink } from '../../components/Button'
import { GrowthRuler } from '../../components/GrowthRuler'
import { Label } from '../../components/Label'
import type { Garden, GardenStats, Plant } from '../../lib/api'
import { fadeUp } from '../../lib/motion'
import type { GiftShow } from '../../three/GiftEffects'
import { honestySeal } from '../stats/insights'
import { BIOMES, biomeOf } from './gardenOptions'
import { GardenStage } from './GardenStage'
import { speciesName, STAGE_LABEL, stageOf, summarizePlants } from './plants'
import styles from './FeaturedGarden.module.css'

interface FeaturedGardenProps {
  garden: Garden
  number: number
  plants: Plant[]
  stats: GardenStats | null
  neglected: boolean
  /** true = foi o último aberto; false = escolhido por ter a sessão mais recente */
  remembered: boolean
  /** presentes de amigos tocando na ilha */
  gifts?: GiftShow | null
}

export function FeaturedGarden({ garden, number, plants, stats, neglected, remembered, gifts = null }: FeaturedGardenProps) {
  const { growing, grown } = summarizePlants(plants)
  const seal = honestySeal(stats?.honest_nos ?? 0)
  const biome = BIOMES.find((b) => b.value === biomeOf(garden.biome))?.label.toLowerCase()

  return (
    <motion.section className={styles.featured} variants={fadeUp} aria-labelledby="featured-title">
      <figure className={styles.plate}>
        <div className={styles.frame}>
          <GardenStage garden={garden} plants={plants} neglected={neglected} seal={seal} gifts={gifts} compact />
        </div>
        <figcaption className={styles.caption}>
          <em>
            fig. {number} — ilha de {biome}, {plants.length} {plants.length === 1 ? 'espécime' : 'espécimes'}
          </em>
        </figcaption>
      </figure>

      <div className={styles.text}>
        <p className="kicker">
          Prancha nº {number} · {remembered ? 'última aberta' : 'mais recente'}
        </p>
        <h2 id="featured-title" className={styles.name}>
          <span className={styles.dot} style={{ background: garden.color }} aria-hidden="true" />
          {garden.name}
        </h2>
        <p className={styles.meta}>
          <span className="mono">{garden.focus_minutes} min</span> de foco · {grown} {grown === 1 ? 'árvore adulta' : 'árvores adultas'}
        </p>

        {growing ? (
          <Label
            kicker="Espécime da vez"
            title={
              <>
                <em>{speciesName(growing)}</em> · {STAGE_LABEL[stageOf(growing.growth)]} · <span className="mono">{growing.growth} de 10</span>
              </>
            }
          >
            <GrowthRuler growth={growing.growth} />
          </Label>
        ) : (
          <Label kicker="Espécime da vez" title={<em>Nenhum: o próximo foco planta uma semente.</em>} />
        )}

        {neglected && <p className={styles.note}>As folhas estão amarelando: faz mais de 3 dias sem foco aqui.</p>}

        <div className={styles.actions}>
          <ButtonLink to={`/jardim/${garden.id}/foco`} size="lg" icon={<Play size={17} strokeWidth={1.8} />}>
            Focar agora
          </ButtonLink>
          <ButtonLink to={`/jardim/${garden.id}`} variant="quiet">
            Abrir ficha
          </ButtonLink>
        </div>
      </div>
    </motion.section>
  )
}
