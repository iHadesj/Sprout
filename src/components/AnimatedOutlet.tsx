// Outlet do React Router com transição (Motion). `routeKey` decide o que conta como "tela nova".
// - padrão: a tela que sai some e a nova sobe de leve;
// - `reveal` (troca de página do app): a nova abre num círculo que nasce do ponto do clique.
//   O recorte some no fim (clip-path: none), senão cortaria diálogos e avisos fixos.
import { useRef, useState } from 'react'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { useOutlet } from 'react-router'

/** Onde foi o último toque/clique, relativo ao <main id="app-main"> (esquecido depois de 1,5 s). */
let origin: { x: number; y: number; r: number } | null = null
let forget = 0
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      const main = document.getElementById('app-main')
      if (!main) return
      const box = main.getBoundingClientRect()
      const x = e.clientX - box.left
      const y = Math.max(0, e.clientY - box.top)
      // raio que cobre a tela inteira a partir do ponto
      const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight)) + 40
      origin = { x, y, r }
      window.clearTimeout(forget)
      forget = window.setTimeout(() => (origin = null), 1500)
    },
    { capture: true, passive: true },
  )
}

function revealFrom() {
  if (origin) return origin
  const w = typeof window === 'undefined' ? 1200 : window.innerWidth
  const h = typeof window === 'undefined' ? 800 : window.innerHeight
  return { x: w / 2, y: 0, r: Math.hypot(w / 2, h) + 40 }
}

/**
 * Enquanto a tela está saindo, ela precisa continuar mostrando o conteúdo antigo:
 * sem isto, o Outlet já leria a rota nova e as duas telas ficariam iguais.
 */
export function PresenceOutlet({ context }: { context?: unknown }) {
  const isPresent = useIsPresent()
  const outlet = useOutlet(context)
  const last = useRef(outlet)
  // Ler/gravar ref no render é proposital: guarda o último conteúdo "vivo" sem causar
  // outro render (com estado entraria em loop, já que o useOutlet cria um elemento novo a cada vez).
  // eslint-disable-next-line react/refs
  if (isPresent) last.current = outlet
  // eslint-disable-next-line react/refs
  return last.current
}

/** `context` é repassado pras rotas filhas, como no <Outlet context>. */
export function AnimatedOutlet({
  routeKey,
  className,
  context,
  reveal = false,
}: {
  routeKey: string
  className?: string
  context?: unknown
  reveal?: boolean
}) {
  const reduced = useReducedMotion()
  // o ponto fica congelado por tela: um clique dentro da página não pode mudar o círculo
  // (mudaria o alvo da animação e o recorte voltaria)
  const [frozen, setFrozen] = useState(() => ({ key: routeKey, at: revealFrom() }))
  if (frozen.key !== routeKey) setFrozen({ key: routeKey, at: revealFrom() })
  const at = reveal && !reduced ? frozen.at : null
  return (
    <AnimatePresence mode="wait" initial={false}>
      {at ? (
        <motion.div
          key={routeKey}
          className={className}
          initial={{ clipPath: `circle(0px at ${at.x}px ${at.y}px)` }}
          animate={{ clipPath: `circle(${at.r}px at ${at.x}px ${at.y}px)`, transitionEnd: { clipPath: 'none' } }}
          exit={{ opacity: 0, transition: { duration: 0.14 } }}
          transition={{ duration: 0.45, ease: [0.65, 0, 0.35, 1] }}
        >
          <PresenceOutlet context={context} />
        </motion.div>
      ) : (
        <motion.div
          key={routeKey}
          className={className}
          // só opacidade e y: transform/filter que sobram no fim virariam referência de
          // position: fixed pros filhos (o botão fixo do celular se perderia)
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transitionEnd: { transform: 'none' } }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <PresenceOutlet context={context} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
