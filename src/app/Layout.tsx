// Moldura das telas logadas: o cabeçalho do caderno (título + navegação em texto, com um
// sublinhado que desliza até a página atual) e a troca animada de telas.
// Durante o foco o cabeçalho some (menos tentação de clicar em outra coisa).
import { LayoutGroup, motion } from 'motion/react'
import { Link, NavLink, useLocation } from 'react-router'
import { AnimatedOutlet } from '../components/AnimatedOutlet'
import { Toaster } from '../components/Toaster'
import { spring } from '../lib/motion'
import { useFriends } from '../features/friends/queries'
import { useFocusStore } from '../stores/focusStore'
import styles from './Layout.module.css'

const LINKS = [
  { to: '/', label: 'Índice', end: true },
  { to: '/estatisticas', label: 'Diário de campo', short: 'Diário', end: false },
  { to: '/amigos', label: 'Amigos', end: false },
  { to: '/conta', label: 'Ficha', end: false },
]

export function Layout() {
  const focusing = useFocusStore((s) => s.timer.phase === 'focus')
  const { pathname } = useLocation()
  // pedido de amizade esperando resposta: bolinha no "Amigos"
  const friends = useFriends()
  const pending = friends.data?.some((f) => f.direction === 'incoming') ?? false
  // /jardim/:id e /jardim/:id/foco são a mesma tela (a cena 3D não pode remontar)
  const routeKey = pathname.split('/').slice(0, 3).join('/')

  return (
    <LayoutGroup>
      <div className={styles.shell}>
        <motion.header
          className={styles.header}
          animate={focusing ? { opacity: 0, y: -12 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          aria-hidden={focusing}
          inert={focusing}
        >
          <Link to="/" className={styles.brand}>
            Sprout <span className={styles.subtitle}>caderno de campo</span>
          </Link>
          <nav className={styles.nav} aria-label="Principal">
            {LINKS.map(({ to, label, short, end }) => (
              <NavLink key={to} to={to} end={end} className={styles.link}>
                {({ isActive }) => (
                  <>
                    <span className={styles.full}>{label}</span>
                    <span className={styles.short}>{short ?? label}</span>
                    {to === '/amigos' && pending && <span className={styles.badge} aria-label="pedido de amizade" />}
                    {isActive && <motion.span layoutId="nav-underline" className={styles.underline} transition={spring.soft} />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </motion.header>
        <main className={styles.main}>
          <AnimatedOutlet routeKey={routeKey} />
        </main>
        <Toaster />
      </div>
    </LayoutGroup>
  )
}
