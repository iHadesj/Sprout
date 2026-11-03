// Botão do app, em cápsula. Variantes: principal (verde de herbário), secundário (contorno de
// tinta), quiet (link sublinhado) e perigo (vermelho de carimbo). "busy" mostra um traço girando.
// No hover cresce um pouco e no clique dá um "pop" (mola); o ícone (do lucide-animated) anima
// quando o mouse passa por cima do botão inteiro.
import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { Link, type LinkProps } from 'react-router'
import { spring } from '../lib/motion'
import { useIconHover } from './iconHover'
import { LoaderCircleIcon } from './icons/loader-circle'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'
type Size = 'md' | 'sm' | 'lg'

/** Hover cresce, clique encolhe e volta com mola. O quiet (link) só afunda 1 px. */
function press(variant: Variant) {
  return variant === 'quiet'
    ? { whileTap: { y: 1 } }
    : { whileHover: { scale: 1.03 }, whileTap: { scale: 0.95 }, transition: spring.pop }
}

function buttonClass(variant: Variant, size: Size, className?: string) {
  return [styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')
}

function Content({ busy, icon, children }: { busy?: boolean; icon?: ReactNode; children: ReactNode }) {
  return (
    <>
      {busy ? (
        <motion.span className={styles.icon} animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
          <LoaderCircleIcon size={16} strokeWidth={1.8} />
        </motion.span>
      ) : (
        icon && <span className={styles.icon}>{icon}</span>
      )}
      <span>{children}</span>
    </>
  )
}

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant
  size?: Size
  busy?: boolean
  icon?: ReactNode
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', busy, icon, className, type = 'button', disabled, children, ...props }: ButtonProps) {
  const off = disabled || busy
  const animated = useIconHover(icon)
  return (
    <motion.button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={off}
      aria-busy={busy || undefined}
      {...(off ? {} : press(variant))}
      {...animated.hover}
      {...props}
    >
      <Content busy={busy} icon={animated.node}>
        {children}
      </Content>
    </motion.button>
  )
}

const MotionLink = motion.create(Link)

/** Link de navegação com cara de botão. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: Pick<LinkProps, 'to' | 'relative' | 'replace' | 'state'> & {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  className?: string
  children: ReactNode
}) {
  const animated = useIconHover(icon)
  return (
    <MotionLink className={buttonClass(variant, size, className)} {...press(variant)} {...animated.hover} {...props}>
      <Content icon={animated.node}>{children}</Content>
    </MotionLink>
  )
}
