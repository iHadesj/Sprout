// Outlet do React Router com transição (Motion): a tela que sai some e a nova sobe de leve,
// como virar a página. `routeKey` decide o que conta como "tela nova".
import { useRef } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useOutlet } from 'react-router'

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
export function AnimatedOutlet({ routeKey, className, context }: { routeKey: string; className?: string; context?: unknown }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        className={className}
        // só opacidade e y: transform/filter que sobram no fim virariam referência de
        // position: fixed pros filhos (o aviso de saída do foco se perderia)
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transitionEnd: { transform: 'none' } }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <PresenceOutlet context={context} />
      </motion.div>
    </AnimatePresence>
  )
}
