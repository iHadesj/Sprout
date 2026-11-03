// Centro da página principal: a ilha 3D grande do jardim escolhido (sobre uma mancha de papel
// que respira), o nome por cima, "hoje" e "sequência" em pedrinhas encostadas na ilha, os
// jardins num arco logo abaixo e o "Começar foco" (um clique), que é o maior botão da tela.
// No celular, quando o botão sai da tela ao rolar, uma cópia dele gruda no rodapé.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router'
import { PlayIcon } from '../../components/icons/play'
import { Button } from '../../components/Button'
import { Blob } from '../../components/organic/Blob'
import { Magnetic } from '../../components/organic/Magnetic'
import { Orbit } from '../../components/organic/Orbit'
import type { Garden, GardenFlower, Plant } from '../../lib/api'
import { fadeUp, popIn, spring, stagger } from '../../lib/motion'
import type { GiftShow } from '../../three/GiftEffects'
import { useStartFocus } from '../focus/startFocus'
import type { HonestySeal } from '../stats/insights'
import { GardenStage } from './GardenStage'
import { speciesName, STAGE_LABEL, stageOf, summarizePlants } from './plants'
import styles from './FocusLauncher.module.css'

interface FocusLauncherProps {
  gardens: Garden[]
  garden: Garden
  plants: Plant[]
  neglected: boolean
  seal: HonestySeal | null
  onSelect: (id: string) => void
  /** presentes de amigos tocando na ilha */
  gifts?: GiftShow | null
  flowers?: GardenFlower[]
  /** as pedrinhas de hoje e da sequência */
  today: ReactNode
  streak: ReactNode
}

export function FocusLauncher({ gardens, garden, plants, neglected, seal, onSelect, gifts = null, flowers, today, streak }: FocusLauncherProps) {
  const startFocus = useStartFocus()
  const { growing } = summarizePlants(plants)
  const start = () => startFocus(garden.id)
  const { ref: actionsRef, on: stuck } = useStuckOnMobile()

  return (
    <motion.section className={styles.launcher} variants={stagger(0.06)} aria-labelledby="launcher-title">
      <motion.header className={styles.title} variants={fadeUp}>
        <h1 id="launcher-title">{garden.name}</h1>
        <p className={styles.meta}>
          {growing ? (
            <>
              {speciesName(growing, garden.biome)} · {STAGE_LABEL[stageOf(growing.growth)]} · <span className="mono">{growing.growth} de 10</span>
            </>
          ) : (
            'O próximo foco planta uma semente'
          )}
          {neglected && <span className={styles.warn}> · folhas amarelando</span>}
        </p>
      </motion.header>

      <div className={styles.stageWrap}>
        <Blob className={styles.blob} />
        <motion.div
          className={styles.stage}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring.soft, opacity: { duration: 0.3 } }}
        >
          <GardenStage garden={garden} plants={plants} neglected={neglected} seal={seal} gifts={gifts} flowers={flowers} compact />
        </motion.div>
        <div className={styles.today}>{today}</div>
        <div className={styles.streak}>{streak}</div>
      </div>

      {gardens.length > 1 && (
        <motion.div variants={stagger(0.05, 0.15)}>
          <Orbit className={styles.chips} role="radiogroup" aria-label="Jardim" bend={22} tilt={5}>
            {gardens.map((g) => (
              <motion.button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={g.id === garden.id}
                className={styles.chip}
                variants={popIn}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => onSelect(g.id)}
              >
                <span className={styles.dot} style={{ background: g.color }} aria-hidden="true" />
                {g.name}
              </motion.button>
            ))}
          </Orbit>
        </motion.div>
      )}

      <motion.div className={styles.actions} variants={fadeUp} ref={actionsRef}>
        <Magnetic>
          <Button size="lg" icon={<PlayIcon size={20} />} onClick={start}>
            Começar foco
          </Button>
        </Magnetic>
        <span className={styles.aside}>
          <span className="mono">{garden.focus_minutes} min</span>
          <Link to={`/jardim/${garden.id}`} className={styles.open}>
            Abrir jardim
          </Link>
        </span>
      </motion.div>

      <AnimatePresence>
        {stuck && (
          <motion.div
            key="sticky"
            className={styles.sticky}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.pop }}
            exit={{ opacity: 0, y: 20, transition: { duration: 0.15 } }}
          >
            <Button size="lg" icon={<PlayIcon size={20} />} onClick={start}>
              Começar foco · <span className="mono">{garden.focus_minutes} min</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

/**
 * Celular: o botão da página saiu por cima ao rolar? Então a cópia gruda no rodapé.
 * No desktop (ou com o botão à vista) fica só o da página.
 */
function useStuckOnMobile() {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const mobile = window.matchMedia('(max-width: 759px)')
    const observer = new IntersectionObserver(([entry]) => {
      setOn(mobile.matches && !entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, on }
}
