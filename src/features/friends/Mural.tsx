// Mural de conquistas: árvores adultas e marcos de dias seguidos (seus e dos amigos), dos
// últimos 14 dias. Nas dos amigos tem o botão de aplaudir (uma vez por conquista): o amigo
// recebe o aplauso como presente e vê fogos na ilha. O texto é montado aqui; os dados e a
// regra de "uma vez" são do servidor (friend_feed, clap).
import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Drift } from '../../components/organic/Drift'
import { PartyPopperIcon } from '../../components/icons/party-popper'
import { useIconHover } from '../../components/iconHover'
import { friendGardens, type FeedEvent } from '../../lib/api'
import { fromSide, spring } from '../../lib/motion'
import { toast } from '../../lib/toast'
import { useNow } from '../../lib/useNow'
import { useGardens } from '../gardens/queries'
import { adultName } from '../gardens/plants'
import { friendKeys, useClap, useFeed } from './queries'
import styles from './Mural.module.css'

/** `biome`: o bioma do jardim da conquista (na neve, a árvore tem outro nome: abeto, bétula...). */
function describe(e: FeedEvent, biome: string | null) {
  const who = e.is_me ? 'Você' : e.username ? `@${e.username}` : 'Alguém'
  if (e.kind === 'adult') {
    return `${who} deixou ${adultName({ species: e.detail ?? '' }, biome)}${e.garden_name ? ` em ${e.garden_name}` : ''}`
  }
  return `${who} chegou a ${e.detail} dias seguidos de foco`
}

function ago(iso: string, now: number) {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

export function Mural({ limit, emptyText }: { limit?: number; emptyText?: string }) {
  const feed = useFeed()
  const now = useNow(60_000, true, Date.now)
  const events = (feed.data ?? []).slice(0, limit)
  const biomeOf = useGardenBiomes(events)

  if (feed.isSuccess && events.length === 0) {
    return <p className={styles.empty}>{emptyText ?? 'Nenhuma conquista nos últimos 14 dias.'}</p>
  }

  return (
    <Drift as="ul" className={styles.list}>
      {events.map((e, i) => (
        // entra alternando os lados; só quando aparece na tela
        <motion.li
          key={e.event_key}
          className={styles.item}
          variants={fromSide}
          custom={i % 2 ? 1 : -1}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-30px' }}
        >
          <span className={styles.text}>
            {describe(e, biomeOf(e))}
            <span className={styles.when}> · {ago(e.happened_at, now)}</span>
          </span>
          {e.is_me ? (
            e.claps > 0 && (
              <span className={styles.count}>
                <span className="mono">{e.claps}</span> {e.claps === 1 ? 'aplauso' : 'aplausos'}
              </span>
            )
          ) : (
            <ClapButton event={e} />
          )}
        </motion.li>
      ))}
    </Drift>
  )
}

/**
 * Bioma do jardim de cada conquista de árvore (pelo nome do jardim): os seus vêm da sua lista
 * de jardins; os dos amigos, da lista de jardins de cada um (as mesmas consultas da visita).
 */
function useGardenBiomes(events: FeedEvent[]) {
  const mine = useGardens()
  const friendIds = [...new Set(events.filter((e) => e.kind === 'adult' && !e.is_me).map((e) => e.user_id))]
  const theirs = useQueries({
    queries: friendIds.map((id) => ({ queryKey: friendKeys.gardens(id), queryFn: () => friendGardens(id), retry: false, staleTime: 5 * 60_000 })),
  })
  return (e: FeedEvent) => {
    if (e.kind !== 'adult') return null
    const list = e.is_me ? mine.data : theirs[friendIds.indexOf(e.user_id)]?.data
    return list?.find((g) => g.name === e.garden_name)?.biome ?? null
  }
}

function ClapButton({ event }: { event: FeedEvent }) {
  const clap = useClap()
  const [burst, setBurst] = useState(0)
  const animated = useIconHover(<PartyPopperIcon size={18} />)
  const done = event.clapped

  return (
    <motion.button
      type="button"
      className={styles.clap}
      data-done={done || undefined}
      disabled={done || clap.isPending}
      whileHover={done ? undefined : { scale: 1.06, rotate: -2 }}
      whileTap={{ scale: 0.9 }}
      transition={spring.pop}
      aria-label={done ? `Você aplaudiu (${event.claps})` : `Aplaudir (${event.claps})`}
      onClick={() =>
        clap.mutate(
          { to: event.user_id, eventKey: event.event_key },
          { onSuccess: () => setBurst((n) => n + 1), onError: (error) => toast.error(error.message) },
        )
      }
      {...animated.hover}
    >
      {animated.node}
      <span className="mono">{event.claps}</span>
      <AnimatePresence>
        {burst > 0 &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <motion.span
              key={`${burst}-${i}`}
              className={styles.spark}
              data-i={i % 3}
              initial={{ opacity: 1, x: 0, y: 0, scale: 0.4 }}
              animate={{ opacity: 0, x: Math.cos((i / 6) * Math.PI * 2) * 26, y: Math.sin((i / 6) * Math.PI * 2) * 22 - 8, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              aria-hidden="true"
            />
          ))}
      </AnimatePresence>
    </motion.button>
  )
}
