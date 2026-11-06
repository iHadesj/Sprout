// Botão de coração da visita: tocar manda 1; segurar acelera (a cada passada manda mais que a
// anterior, até 64 por vez), dá pra mandar centenas. Os corações juntam e vão pro servidor em
// lotes (até 999 por envio, o limite do banco), uns instantes depois: tocar 50 vezes não vira
// 50 requisições. Cada envio solta coraçõezinhos "+N" do botão e (via onSent) na ilha.
// O botão é um coração 3D que reage no lugar a cada toque (carregado à parte; até ele chegar,
// ou sem WebGL, fica o coração desenhado).
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { HeartIcon } from '../../components/icons/heart'
import { sendGift } from '../../lib/api'
import { toast } from '../../lib/toast'
import styles from './HeartTap.module.css'

const HeartButton3D = lazy(() => import('../../three/HeartButton3D'))

const FLUSH_MS = 700
const HOLD_DELAY_MS = 320
const HOLD_EVERY_MS = 90
const MAX_PER_TICK = 64

interface Floater {
  id: number
  x: number
  amount: number
}

export function HeartTap({ to, onSent }: { to: string; onSent: (amount: number) => void }) {
  const [total, setTotal] = useState(0)
  const reduced = useReducedMotion() ?? false
  const [floaters, setFloaters] = useState<Floater[]>([])
  const pending = useRef(0)
  const flushTimer = useRef<number | null>(null)
  const hold = useRef<number | null>(null)
  const nextId = useRef(0)

  const flush = useCallback(async () => {
    flushTimer.current = null
    let left = pending.current
    pending.current = 0
    while (left > 0) {
      const chunk = Math.min(999, left)
      left -= chunk
      try {
        await sendGift(to, 'heart', chunk)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Não deu pra mandar os corações')
        return
      }
    }
  }, [to])

  // saiu da tela com corações na fila: manda o que falta
  useEffect(
    () => () => {
      if (hold.current) window.clearTimeout(hold.current)
      if (flushTimer.current) window.clearTimeout(flushTimer.current)
      if (pending.current > 0) void flush()
    },
    [flush],
  )

  const add = (amount: number) => {
    setTotal((t) => t + amount)
    onSent(amount)
    pending.current += amount
    if (flushTimer.current === null) flushTimer.current = window.setTimeout(() => void flush(), FLUSH_MS)
    nextId.current += 1
    const floater = { id: nextId.current, x: Math.random() * 60 - 30, amount }
    setFloaters((list) => (list.length > 8 ? list : [...list, floater]))
  }

  const stop = () => {
    if (hold.current) window.clearTimeout(hold.current)
    hold.current = null
  }

  const start = () => {
    stop()
    add(1)
    let ticks = 0
    const step = () => {
      ticks += 1
      add(Math.min(MAX_PER_TICK, Math.floor(1.35 ** ticks)))
      hold.current = window.setTimeout(step, HOLD_EVERY_MS)
    }
    hold.current = window.setTimeout(step, HOLD_DELAY_MS)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.buttonBox}>
        <motion.button
          type="button"
          className={styles.heart}
          aria-label="Mandar coração (segure pra mandar muitos)"
          whileTap={{ scale: 0.94 }}
          onPointerDown={(event) => {
            event.preventDefault()
            start()
          }}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onContextMenu={(event) => event.preventDefault()}
          // teclado (Enter/Espaço) dispara click sem pointerdown
          onClick={(event) => {
            if (event.detail === 0) add(1)
          }}
        >
          <span className={styles.flat} aria-hidden="true">
            <HeartIcon size={38} filled />
          </span>
        </motion.button>
        {/* o coração 3D fica por cima do botão e não recebe clique */}
        <span className={styles.three} aria-hidden="true">
          <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <HeartButton3D taps={total} motion={!reduced} />
            </Suspense>
          </ErrorBoundary>
        </span>
        <AnimatePresence>
          {floaters.map((f) => (
            <motion.span
              key={f.id}
              className={styles.floater}
              initial={{ opacity: 1, y: 0, x: f.x * 0.3, scale: 0.6 }}
              animate={{ opacity: 0, y: -90, x: f.x, scale: 1.1 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              onAnimationComplete={() => setFloaters((list) => list.filter((item) => item.id !== f.id))}
              aria-hidden="true"
            >
              <HeartIcon size={14} filled />
              {f.amount > 1 && <span className="mono">+{f.amount}</span>}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <div className={styles.count} aria-live="polite">
        <motion.span key={total} className={`mono ${styles.total}`} initial={{ scale: 1.25 }} animate={{ scale: 1 }}>
          {total}
        </motion.span>
        <span className={styles.label}>
          {total === 0 ? 'toque pra mandar, segure pra mandar muitos' : total === 1 ? 'coração enviado' : 'corações enviados'}
        </span>
      </div>
    </div>
  )
}
