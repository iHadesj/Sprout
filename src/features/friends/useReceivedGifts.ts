// Presentes recebidos, prontos pra tela: agrupados por amigo, com a animação pra ilha.
// Ao chegarem, o servidor marca como vistos; "ver de novo" só repete a animação.
import { useEffect, useMemo, useRef, useState } from 'react'
import { markGiftsSeen, type UnseenGift } from '../../lib/api'
import type { GiftShow } from '../../three/GiftEffects'
import { useUnseenGifts } from './queries'

export interface Line {
  from: string
  water: boolean
  hearts: number
}

/** Junta os presentes por quem mandou: "@edu regou seu jardim e mandou 999 corações". */
function byFriend(gifts: UnseenGift[]): Line[] {
  const map = new Map<string, Line>()
  for (const g of gifts) {
    const line = map.get(g.from_id) ?? { from: g.from_username ? `@${g.from_username}` : 'Um amigo', water: false, hearts: 0 }
    if (g.kind === 'water') line.water = true
    else line.hearts += g.amount
    map.set(g.from_id, line)
  }
  return [...map.values()]
}

export function useReceivedGifts() {
  const unseen = useUnseenGifts()
  const [play, setPlay] = useState(1)
  const marked = useRef(false)

  useEffect(() => {
    if (marked.current || !unseen.data?.length) return
    marked.current = true
    void markGiftsSeen().catch(() => {
      marked.current = false // tenta de novo na próxima vez
    })
  }, [unseen.data])

  const lines = useMemo(() => byFriend(unseen.data ?? []), [unseen.data])
  const show: GiftShow | null = lines.length
    ? { id: play, water: lines.some((l) => l.water), hearts: lines.reduce((sum, l) => sum + l.hearts, 0) }
    : null

  return { lines, show, replay: () => setPlay((n) => n + 1) }
}
