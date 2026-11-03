// Painel do jardim (ao lado da ilha): o "Começar foco" (um clique), a árvore da vez com a
// régua de crescimento, os números num cacho de pedrinhas, o carimbo de honestidade, os avisos
// (esquecido, com uma seta pra árvore; revisão pendente) e editar/arquivar. No desktop as
// linhas recuam seguindo a curva da ilha; o título morde a beirada dela.
import { useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeftIcon } from '../../components/icons/arrow-left'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { PlayIcon } from '../../components/icons/play'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { GrowthRuler } from '../../components/GrowthRuler'
import { Label } from '../../components/Label'
import { bulge } from '../../components/organic/curve'
import { Magnetic } from '../../components/organic/Magnetic'
import { Pebble } from '../../components/organic/Pebble'
import { Stamp } from '../../components/Stamp'
import { fadeUp, stagger } from '../../lib/motion'
import { toast } from '../../lib/toast'
import { PendingReview } from '../focus/PendingReview'
import { usePendingReview } from '../focus/queries'
import { useStartFocus } from '../focus/startFocus'
import { formatMinutes } from '../stats/insights'
import { GardenForm } from './GardenForm'
import { useGardenContext } from './gardenContext'
import { STAGE_LABEL, speciesName, stageOf, summarizePlants } from './plants'
import { useArchiveGarden, useUpdateGarden } from './queries'
import styles from './GardenOverview.module.css'

const LEVEL = ['', 'I', 'II', 'III']

/** Recuo de cada linha do painel no desktop: cresce até o meio e volta, contornando a ilha. */
const indent = (i: number) => ({ '--indent': `${bulge(i, 7, 64)}px` }) as CSSProperties

export function GardenOverview() {
  const { garden, plants, stats, neglected, seal } = useGardenContext()
  const { growing, grown, dead } = summarizePlants(plants)
  const pending = usePendingReview(garden.id)
  const update = useUpdateGarden(garden.id)
  const archive = useArchiveGarden(garden.id)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const startFocus = useStartFocus()

  return (
    <motion.div className={styles.sheet} variants={stagger(0.05)} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className={styles.row} style={indent(0)}>
        <Link to="/" className={styles.back}>
          <ArrowLeftIcon size={15} /> Início
        </Link>
      </motion.div>

      <motion.header className={styles.header} variants={fadeUp}>
        <h1>{garden.name}</h1>
        <p className={styles.meta}>
          <span className={styles.dot} style={{ background: garden.color }} aria-hidden="true" />
          <span className="mono">{garden.focus_minutes} min</span> de foco · <span className="mono">{garden.break_minutes} min</span> de pausa
        </p>
      </motion.header>

      <motion.div className={`${styles.actions} ${styles.row}`} style={indent(1)} variants={fadeUp}>
        <Magnetic>
          <Button size="lg" icon={<PlayIcon size={18} />} onClick={() => startFocus(garden.id)}>
            Começar foco
          </Button>
        </Magnetic>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Editar
        </Button>
      </motion.div>

      <motion.div variants={fadeUp} className={styles.row} style={indent(2)}>
        {growing ? (
          <Label
            kicker="Árvore da vez"
            title={
              <>
                <em>{speciesName(growing, garden.biome)}</em> · {STAGE_LABEL[stageOf(growing.growth)]} ·{' '}
                <span className="mono">{growing.growth} de 10</span>
              </>
            }
          >
            <GrowthRuler growth={growing.growth} />
          </Label>
        ) : (
          <Label kicker="Árvore da vez" title={<em>Nenhuma: o próximo foco planta uma semente.</em>} />
        )}
      </motion.div>

      <motion.div className={`${styles.cluster} ${styles.row}`} style={indent(3)} variants={stagger(0.08)} aria-label="Números do jardim">
        <Pebble size="lg" value={formatMinutes(stats?.minutes ?? 0)} label="de foco aqui" />
        <Pebble size="md" value={<AnimatedNumber value={grown} />} chars={2} label={grown === 1 ? 'adulta' : 'adultas'} />
        <Pebble size="sm" value={<AnimatedNumber value={dead} />} chars={2} label={dead === 1 ? 'seca' : 'secas'} />
        <Pebble size="sm" value={<AnimatedNumber value={stats?.completed ?? 0} />} chars={3} label="sessões" />
      </motion.div>

      <AnimatePresence>
        {seal && (
          <motion.div key="seal" className={`${styles.seal} ${styles.row}`} style={indent(4)} variants={fadeUp}>
            <Stamp shape="round" note={`nível ${LEVEL[seal.level]}`}>
              Sincero
            </Stamp>
            <p>
              <strong>{seal.label}</strong>: você admitiu {stats?.honest_nos} {stats?.honest_nos === 1 ? 'vez' : 'vezes'} que não
              focou.
            </p>
          </motion.div>
        )}
        {neglected && (
          <motion.p key="neglect" className={`${styles.margin} ${styles.row}`} style={indent(5)} role="status" variants={fadeUp}>
            <svg className={styles.arrow} viewBox="0 0 64 40" aria-hidden="true">
              <path d="M60 6 C 44 2, 26 8, 18 22 C 14 28, 12 32, 10 36" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M4 28 L 10 37 L 17 30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Faz mais de 3 dias sem foco aqui, então as folhas amarelaram. Um foco concluído volta tudo ao normal.
          </motion.p>
        )}
      </AnimatePresence>

      {pending.data && <PendingReview session={pending.data} />}

      <motion.div className={`${styles.archive} ${styles.row}`} style={indent(6)} variants={fadeUp}>
        {confirmArchive ? (
          <div className={styles.archiveConfirm}>
            <p>O jardim sai do índice, mas nada é apagado.</p>
            <Button variant="quiet" size="sm" onClick={() => setConfirmArchive(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              busy={archive.isPending}
              onClick={() =>
                archive.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(`"${garden.name}" foi arquivado`)
                    navigate('/')
                  },
                })
              }
            >
              Arquivar
            </Button>
          </div>
        ) : (
          <Button variant="quiet" size="sm" onClick={() => setConfirmArchive(true)}>
            Arquivar jardim
          </Button>
        )}
      </motion.div>

      <Dialog open={editing} title="Editar jardim" onClose={() => setEditing(false)}>
        <GardenForm
          initial={garden}
          submitLabel="Salvar"
          busy={update.isPending}
          error={update.error?.message}
          onSubmit={(input) =>
            update.mutate(input, {
              onSuccess: () => {
                setEditing(false)
                toast.success('Jardim atualizado')
              },
            })
          }
        />
      </Dialog>
    </motion.div>
  )
}
