// Moldura do login e do cadastro: a cena 3D tela cheia, o wordmark e o card do form.
// É um layout acima das duas rotas, então a muda não reinicia ao trocar de uma pra outra:
// só o miolo do card troca (mode="wait"), e o card muda de altura com `layout`, sem pulo.
// O e-mail, a senha e o envio moram aqui (chegam nas rotas pelo outlet context). Daqui saem
// o `stage` da muda e o roteiro do fim: erro (balanço + folhas murchas) ou sucesso (o card
// sai, a muda floresce, a câmera se aproxima, a cena some no papel e o app abre).
import { lazy, Suspense, useCallback, useEffect, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { PresenceOutlet } from '../../components/AnimatedOutlet'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { IslandIcon } from '../gardens/IslandIcon'
import { useAuth } from './authContext'
import { authMessage, type AuthFormState, type AuthMessage, type SubmitOutcome } from './authForm'
import {
  canvasVariants,
  cardLayout,
  cardVariants,
  formDelay,
  formVariants,
  letterVariants,
  screenVariants,
  shake,
  skyCss,
  successDuration,
  TIMING,
  wordmarkVariants,
} from './motion/loginVariants'
import { sproutStage } from './sproutStage'
import styles from './AuthLayout.module.css'

const LoginScene = lazy(() => import('../../three/LoginScene'))

const AUTH_PATHS = ['/entrar', '/criar-conta']

type Phase = 'idle' | 'busy' | 'success'

export function AuthLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const reduced = useReducedMotion() ?? false

  const [email, setEmailValue] = useState('')
  const [password, setPasswordValue] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [wilting, setWilting] = useState(false)
  // a mensagem vale só pra tela em que apareceu
  const [message, setMessage] = useState<(AuthMessage & { path: string }) | null>(null)
  const [sceneReady, setSceneReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // rota com que a tela abriu: os campos dela esperam o card chegar; os de uma rota nova entram logo
  const [firstKey] = useState(location.key)
  const [cardScope, animateCard] = useAnimate<HTMLDivElement>()

  const from = (location.state as { from?: string } | null)?.from
  const destination = from && !AUTH_PATHS.includes(from) ? from : '/'
  const showScene = useCallback(() => setSceneReady(true), [])

  // erro: as folhas ficam murchas um tempo e voltam sozinhas
  useEffect(() => {
    if (!wilting) return
    const id = setTimeout(() => setWilting(false), TIMING.wiltMs)
    return () => clearTimeout(id)
  }, [wilting])

  // sucesso: espera a flor e o dolly, apaga a cena no papel e abre o app
  useEffect(() => {
    if (phase !== 'success') return
    const total = successDuration(reduced)
    const fade = setTimeout(() => setLeaving(true), (total - TIMING.success.fadeOut) * 1000)
    const go = setTimeout(() => navigate(destination, { replace: true }), total * 1000)
    return () => {
      clearTimeout(fade)
      clearTimeout(go)
    }
  }, [phase, reduced, navigate, destination])

  if (loading) return null
  // já logado ao abrir a tela: vai direto (durante o envio, quem decide é o roteiro do sucesso)
  if (user && phase === 'idle') return <Navigate to={destination} replace />

  const clearError = () => setMessage((m) => (m?.kind === 'error' ? null : m))

  const form: AuthFormState = {
    email,
    setEmail: (value) => {
      setEmailValue(value)
      clearError()
    },
    password,
    setPassword: (value) => {
      setPasswordValue(value)
      clearError()
    },
    busy: phase !== 'idle',
    message: message?.path === location.pathname ? message : null,
    linkState: location.state,
    submit: (send: () => Promise<SubmitOutcome>) => {
      if (phase !== 'idle') return
      const path = location.pathname
      setPhase('busy')
      setMessage(null)
      setWilting(false)
      void send().then(
        (outcome) => {
          if (outcome.kind === 'signed-in') return setPhase('success')
          setPhase('idle')
          setMessage({ kind: 'info', text: outcome.text, path })
        },
        (error: unknown) => {
          setPhase('idle')
          setWilting(true)
          setMessage({ kind: 'error', text: authMessage(error), path })
          if (!reduced && cardScope.current) void animateCard(cardScope.current, shake.keyframes, shake.transition)
        },
      )
    },
  }

  const stage = sproutStage({ email, password, busy: phase === 'busy', wilting, success: phase === 'success' })
  const fallback = <StaticSprout onShow={showScene} />

  return (
    <motion.main className={styles.screen} style={{ '--sky': skyCss } as CSSProperties} variants={screenVariants} initial="hidden" animate="show">
      <motion.div className={styles.scene} variants={canvasVariants} initial="hidden" animate={leaving ? 'leaving' : sceneReady ? 'show' : 'hidden'}>
        <ErrorBoundary fallback={fallback}>
          <Suspense fallback={null}>
            <LoginScene stage={stage} onReady={showScene} fallback={fallback} />
          </Suspense>
        </ErrorBoundary>
      </motion.div>

      <motion.h1 className={styles.wordmark} variants={wordmarkVariants} aria-label="sprout">
        {[...'sprout'].map((letter, i) => (
          <motion.span key={i} variants={letterVariants} aria-hidden="true">
            {letter}
          </motion.span>
        ))}
      </motion.h1>

      <AnimatePresence>
        {phase !== 'success' && (
          // o balanço do erro fica neste div; a entrada/saída e a altura, no card
          <div key="card" ref={cardScope} className={styles.cardWrap}>
            <motion.div
              className={styles.card}
              style={{ borderRadius: 12 }}
              layout
              transition={cardLayout}
              variants={cardVariants(reduced)}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  layout="position"
                  variants={formVariants}
                  custom={formDelay(location.key === firstKey)}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                >
                  <PresenceOutlet context={form} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.main>
  )
}

/** Sem WebGL (ou se a cena quebrar): a ilhazinha a traço no lugar da cena. */
function StaticSprout({ onShow }: { onShow: () => void }) {
  useEffect(onShow, [onShow])
  return (
    <div className={styles.fallback}>
      <div style={{ width: 160 }}>
        <IslandIcon color="#f08fb0" biome="campo" />
      </div>
    </div>
  )
}
