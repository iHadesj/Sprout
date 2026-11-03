// Visita ao jardim de um amigo (/amigos/:userId): a ilha 3D dele (só olhando), as horas
// da semana e os presentes: regar (1 por dia) e corações (1 a 999, segurar o botão acelera).
// Quem manda vê o presente tocar na ilha do amigo; ele vê de novo quando abrir o Sprout.
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, Droplets, Heart, Minus, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import { fadeUp, stagger } from '../../lib/motion'
import { toast } from '../../lib/toast'
import { useNow } from '../../lib/useNow'
import type { GiftShow } from '../../three/GiftEffects'
import { useProfile } from '../account/queries'
import { GardenStage } from '../gardens/GardenStage'
import { BIOMES, biomeOf } from '../gardens/gardenOptions'
import { summarizePlants } from '../gardens/plants'
import { formatMinutes, todayIn } from '../stats/insights'
import { useFriendGardens, useFriendPlants, useFriends, useLastWater, useRanking, useSendGift } from './queries'
import layout from '../gardens/GardenLayout.module.css'
import styles from './FriendGarden.module.css'

const MAX_HEARTS = 999

export function FriendGarden() {
  const { userId = '' } = useParams()
  const gardens = useFriendGardens(userId)
  const plants = useFriendPlants(userId)
  const friends = useFriends()
  const ranking = useRanking()
  const lastWater = useLastWater(userId)
  const profile = useProfile()
  const gift = useSendGift(userId)
  const now = useNow(60_000, true, Date.now)
  const [index, setIndex] = useState(0)
  const [hearts, setHearts] = useState(1)
  const [show, setShow] = useState<GiftShow | null>(null)

  const name = friends.data?.find((f) => f.user_id === userId)?.username ?? null
  const handle = name ? `@${name}` : 'seu amigo'
  const garden = gardens.data?.[Math.min(index, (gardens.data?.length ?? 1) - 1)]
  const gardenPlants = (plants.data ?? []).filter((p) => p.garden_id === garden?.id)
  const { grown, dead } = summarizePlants(gardenPlants)
  const week = ranking.data?.find((r) => r.user_id === userId)
  const timeZone = profile.data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const wateredToday = !!lastWater.data && todayIn(timeZone, Date.parse(lastWater.data)) === todayIn(timeZone, now)
  const biome = garden ? BIOMES.find((b) => b.value === biomeOf(garden.biome))?.label.toLowerCase() : ''

  const play = (water: boolean, count: number) => setShow((s) => ({ id: (s?.id ?? 0) + 1, water, hearts: count }))

  const water = () =>
    gift.mutate(
      { kind: 'water' },
      {
        onSuccess: () => {
          play(true, 0)
          toast.success(`Você regou o jardim de ${handle}`)
        },
        onError: (error) => toast.error(error.message),
      },
    )

  const sendHearts = () =>
    gift.mutate(
      { kind: 'heart', amount: hearts },
      {
        onSuccess: () => {
          play(false, hearts)
          toast.success(`${hearts} ${hearts === 1 ? 'coração enviado' : 'corações enviados'} pra ${handle}`)
        },
        onError: (error) => toast.error(error.message),
      },
    )

  if (gardens.isError) {
    return (
      <div className={layout.status}>
        <p>Vocês não são amigos (ou a amizade foi desfeita), então esse jardim não aparece.</p>
        <ButtonLink to="/amigos" variant="secondary">
          Voltar pros amigos
        </ButtonLink>
      </div>
    )
  }
  if (gardens.isPending) return <p className={layout.status}>Abrindo o jardim…</p>

  return (
    <div className={layout.page}>
      <figure className={layout.plate} aria-label={garden ? `Jardim ${garden.name} de ${handle}` : `Jardins de ${handle}`}>
        <div className={layout.frame}>
          {garden ? (
            <GardenStage garden={garden} plants={gardenPlants} neglected={false} seal={null} gifts={show} visiting />
          ) : (
            <p className={layout.status}>{handle} ainda não criou nenhum jardim.</p>
          )}
        </div>
        {garden && (
          <figcaption className={layout.caption}>
            <span className="kicker">Jardim de {handle}</span>
            <em>
              ilha de {biome}, {gardenPlants.length} {gardenPlants.length === 1 ? 'espécime' : 'espécimes'}
            </em>
          </figcaption>
        )}
      </figure>

      <section className={layout.sheet}>
        <motion.div className={styles.sheet} variants={stagger(0.05)} initial="hidden" animate="show">
          <motion.div variants={fadeUp}>
            <Link to="/amigos" className={styles.back}>
              <ArrowLeft size={15} strokeWidth={1.7} /> Amigos
            </Link>
          </motion.div>

          <motion.header className={styles.header} variants={fadeUp}>
            <p className="kicker">Visitando</p>
            <h1>{handle}</h1>
            <p className={styles.meta}>
              <span className="mono">{formatMinutes(week?.minutes ?? 0)}</span> de foco esta semana
            </p>
          </motion.header>

          {(gardens.data?.length ?? 0) > 1 && (
            <motion.div className={styles.tabs} variants={fadeUp} role="tablist" aria-label="Jardins">
              {gardens.data?.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={g.id === garden?.id}
                  className={styles.tab}
                  onClick={() => setIndex(i)}
                >
                  <span className={styles.dot} style={{ background: g.color }} aria-hidden="true" />
                  {g.name}
                </button>
              ))}
            </motion.div>
          )}

          {garden && (
            <motion.dl className={styles.records} variants={fadeUp}>
              <div>
                <dt>Jardim</dt>
                <dd>{garden.name}</dd>
              </div>
              <div>
                <dt>Árvores adultas</dt>
                <dd className="mono">{grown}</dd>
              </div>
              <div>
                <dt>Árvores secas</dt>
                <dd className="mono">{dead}</dd>
              </div>
            </motion.dl>
          )}

          <motion.section className={styles.gifts} variants={fadeUp} aria-labelledby="presentes">
            <h2 id="presentes" className="kicker">
              Mandar um carinho
            </h2>
            <div className={styles.giftRow}>
              <Button
                variant="secondary"
                icon={<Droplets size={17} strokeWidth={1.7} />}
                disabled={wateredToday || !garden}
                busy={gift.isPending && gift.variables?.kind === 'water'}
                onClick={water}
              >
                {wateredToday ? 'Regado hoje' : 'Regar o jardim'}
              </Button>
              <span className={styles.hint}>uma vez por dia</span>
            </div>

            <div className={styles.giftRow}>
              <HeartCounter value={hearts} onChange={setHearts} />
              <Button
                icon={<Heart size={16} strokeWidth={0} fill="currentColor" />}
                busy={gift.isPending && gift.variables?.kind === 'heart'}
                onClick={sendHearts}
              >
                Mandar {hearts} {hearts === 1 ? 'coração' : 'corações'}
              </Button>
            </div>
            <p className={styles.hint}>Quando {handle} abrir o Sprout, os presentes aparecem na ilha.</p>
          </motion.section>
        </motion.div>
      </section>
    </div>
  )
}

/** Contador de 1 a 999: clicar soma 1; segurar acelera (1, depois 5, depois 25 por vez). */
function HeartCounter({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const hold = useRef<{ timer: number; ticks: number } | null>(null)
  const current = useRef(value)
  useEffect(() => {
    current.current = value
  }, [value])

  const clamp = (n: number) => Math.max(1, Math.min(MAX_HEARTS, n))
  const stop = () => {
    if (hold.current) window.clearTimeout(hold.current.timer)
    hold.current = null
  }
  useEffect(() => stop, [])

  const start = (direction: 1 | -1) => {
    stop()
    const state = { timer: 0, ticks: 0 }
    hold.current = state
    const step = () => {
      const amount = state.ticks < 6 ? 1 : state.ticks < 20 ? 5 : 25
      onChange(clamp(current.current + direction * amount))
      state.ticks += 1
      state.timer = window.setTimeout(step, state.ticks === 1 ? 380 : 90)
    }
    step()
  }

  const press = (direction: 1 | -1) => ({
    onPointerDown: (event: React.PointerEvent) => {
      event.preventDefault()
      start(direction)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    // teclado: Enter/Espaço disparam click sem pointerdown
    onClick: (event: React.MouseEvent) => {
      if (event.detail === 0) onChange(clamp(value + direction))
    },
  })

  return (
    <div className={styles.counter} role="group" aria-label="Quantos corações">
      <button type="button" className={styles.step} aria-label="Menos um" {...press(-1)}>
        <Minus size={15} strokeWidth={1.8} />
      </button>
      <input
        className={`mono ${styles.amount}`}
        inputMode="numeric"
        value={value}
        aria-label="Quantidade de corações"
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''))
          onChange(clamp(Number.isFinite(n) && n > 0 ? n : 1))
        }}
      />
      <button type="button" className={styles.step} aria-label="Mais um" {...press(1)}>
        <Plus size={15} strokeWidth={1.8} />
      </button>
    </div>
  )
}
