// Botão do app. Variantes: principal (verde de herbário), secundário (contorno de tinta),
// quiet (link sublinhado) e perigo (vermelho de carimbo). "busy" mostra um traço girando.
import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { Link, type LinkProps } from 'react-router'
import { LoaderCircle } from 'lucide-react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'
type Size = 'md' | 'sm' | 'lg'

/** Afunda 1 px no toque, como uma tecla. */
const press = { whileTap: { y: 1 } }

function buttonClass(variant: Variant, size: Size, className?: string) {
  return [styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')
}

function Content({ busy, icon, children }: { busy?: boolean; icon?: ReactNode; children: ReactNode }) {
  return (
    <>
      {busy ? (
        <motion.span className={styles.icon} animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
          <LoaderCircle size={16} strokeWidth={1.8} />
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
  return (
    <motion.button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={off}
      aria-busy={busy || undefined}
      {...(off ? {} : press)}
      {...props}
    >
      <Content busy={busy} icon={icon}>
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
  return (
    <MotionLink className={buttonClass(variant, size, className)} {...press} {...props}>
      <Content icon={icon}>{children}</Content>
    </MotionLink>
  )
}
