// Ficha do jardim (página da direita): o espécime da vez com etiqueta de museu, os registros,
// o carimbo de honestidade, as anotações (esquecido, revisão pendente) e as ações.
import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { Button, ButtonLink } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { GrowthRuler } from '../../components/GrowthRuler'
import { Label } from '../../components/Label'
import { Stamp } from '../../components/Stamp'
import { fadeUp, stagger } from '../../lib/motion'
import { toast } from '../../lib/toast'
import { PendingReview } from '../focus/PendingReview'
import { usePendingReview } from '../focus/queries'
import { formatMinutes } from '../stats/insights'
import { GardenForm } from './GardenForm'
import { useGardenContext } from './gardenContext'
import { STAGE_LABEL, speciesName, stageOf, summarizePlants } from './plants'
import { useArchiveGarden, useUpdateGarden } from './queries'
import styles from './GardenOverview.module.css'

const LEVEL = ['', 'I', 'II', 'III']

export function GardenOverview() {
  const { garden, plants, stats, neglected, seal } = useGardenContext()
  const { growing, grown, dead } = summarizePlants(plants)
  const pending = usePendingReview(garden.id)
  const update = useUpdateGarden(garden.id)
  const archive = useArchiveGarden(garden.id)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  return (
    <motion.div className={styles.sheet} variants={stagger(0.05)} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <Link to="/" className={styles.back}>
          <ArrowLeft size={15} strokeWidth={1.6} /> Índice
        </Link>
      </motion.div>

      <motion.header className={styles.header} variants={fadeUp}>
        <h1>{garden.name}</h1>
        <p className={styles.meta}>
          <span className={styles.dot} style={{ background: garden.color }} aria-hidden="true" />
          <span className="mono">{garden.focus_minutes} min</span> de foco · <span className="mono">{garden.break_minutes} min</span> de pausa
        </p>
      </motion.header>

      <motion.div variants={fadeUp}>
        {growing ? (
          <Label
            kicker={`Espécime nº ${plants.indexOf(growing) + 1} · da vez`}
            title={
              <>
                <em>{speciesName(growing)}</em> · {STAGE_LABEL[stageOf(growing.growth)]} ·{' '}
                <span className="mono">{growing.growth} de 10</span>
              </>
            }
          >
            <GrowthRuler growth={growing.growth} />
          </Label>
        ) : (
          <Label kicker="Espécime da vez" title={<em>Nenhum: o próximo foco planta uma semente.</em>} />
        )}
      </motion.div>

      <motion.section variants={fadeUp} aria-labelledby="records-title">
        <h2 id="records-title" className="kicker">
          Registros
        </h2>
        <dl className={styles.records}>
          <Record label="Árvores adultas" value={<AnimatedNumber value={grown} />} />
          <Record label="Árvores secas" value={<AnimatedNumber value={dead} />} />
          <Record label="Tempo de foco aqui" value={formatMinutes(stats?.minutes ?? 0)} />
          <Record label="Sessões concluídas" value={<AnimatedNumber value={stats?.completed ?? 0} />} />
        </dl>
      </motion.section>

      <AnimatePresence>
        {seal && (
          <motion.div key="seal" className={styles.seal} variants={fadeUp}>
            <Stamp shape="round" note={`nível ${LEVEL[seal.level]}`}>
              Sincero
            </Stamp>
            <p>
              <strong>{seal.label}</strong>: você admitiu {stats?.honest_nos} {stats?.honest_nos === 1 ? 'vez' : 'vezes'} que não
              focou. Sinceridade também cultiva.
            </p>
          </motion.div>
        )}
        {neglected && (
          <motion.p key="neglect" className={styles.margin} role="status" variants={fadeUp}>
            Faz mais de 3 dias sem foco aqui, então as folhas amarelaram. Nada foi perdido: uma sessão concluída volta tudo ao normal.
          </motion.p>
        )}
      </AnimatePresence>

      {pending.data && <PendingReview session={pending.data} />}

      <motion.div className={styles.actions} variants={fadeUp}>
        <ButtonLink to="foco" size="lg">
          Focar agora
        </ButtonLink>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Editar
        </Button>
      </motion.div>

      <motion.div className={styles.archive} variants={fadeUp}>
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

/** Linha de registro: rótulo, pontilhado e valor, como num livro de contas. */
function Record({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.record}>
      <dt>{label}</dt>
      <span className={styles.leader} aria-hidden="true" />
      <dd className="mono">{value}</dd>
    </div>
  )
}
