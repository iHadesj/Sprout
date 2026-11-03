// Presentes recebidos, prontos pra tela: agrupados por amigo, com a animação pra ilha, mais os
// chamados seus que alguém atendeu. Ao chegarem, o servidor marca como vistos; "ver de novo"
// só repete a animação.
import { useEffect, useMemo, useRef, useState } from 'react'
import { markGiftsSeen, markNudgeRepliesSeen, type UnseenGift } from '../../lib/api'
import type { GiftShow } from '../../three/GiftEffects'
import { useNudgeReplies, useUnseenGifts } from './queries'

export interface Line {
  from: string
  water: boolean
  hearts: number
  /** jardins onde plantou flor */
  flowers: string[]
  /** conquistas aplaudidas ("sua macieira adulta") */
  claps: string[]
  seed: boolean
}

/** Junta os presentes por quem mandou. */
function byFriend(gifts: UnseenGift[]): Line[] {
  const map = new Map<string, Line>()
  for (const g of gifts) {
    const line = map.get(g.from_id) ?? {
      from: g.from_username ? `@${g.from_username}` : 'Um amigo',
      water: false,
      hearts: 0,
      flowers: [],
      claps: [],
      seed: false,
    }
    if (g.kind === 'water') line.water = true
    else if (g.kind === 'heart') line.hearts += g.amount
    else if (g.kind === 'flower') line.flowers.push(...g.notes)
    else if (g.kind === 'clap') line.claps.push(...g.notes)
    else if (g.kind === 'seed') line.seed = true
    map.set(g.from_id, line)
  }
  return [...map.values()]
}

export function useReceivedGifts() {
  const unseen = useUnseenGifts()
  const replies = useNudgeReplies()
  const [play, setPlay] = useState(1)
  const marked = useRef({ gifts: false, replies: false })

  useEffect(() => {
    if (marked.current.gifts || !unseen.data?.length) return
    marked.current.gifts = true
    void markGiftsSeen().catch(() => {
      marked.current.gifts = false // tenta de novo na próxima vez
    })
  }, [unseen.data])

  useEffect(() => {
    if (marked.current.replies || !replies.data?.length) return
    marked.current.replies = true
    void markNudgeRepliesSeen().catch(() => {
      marked.current.replies = false
    })
  }, [replies.data])

  const lines = useMemo(() => byFriend(unseen.data ?? []), [unseen.data])
  const answered = useMemo(
    () => (replies.data ?? []).map((r) => ({ who: r.to_username ? `@${r.to_username}` : 'Um amigo', minutes: r.minutes })),
    [replies.data],
  )
  const show: GiftShow | null = lines.length
    ? {
        id: play,
        water: lines.some((l) => l.water),
        hearts: lines.reduce((sum, l) => sum + l.hearts, 0),
        claps: lines.reduce((sum, l) => sum + l.claps.length, 0),
        seed: lines.some((l) => l.seed),
      }
    : null

  return { lines, answered, show, replay: () => setPlay((n) => n + 1) }
}
