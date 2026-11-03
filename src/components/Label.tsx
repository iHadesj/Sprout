// Etiqueta de museu: uma linha pequena em mono ("ESPÉCIME Nº 12") e o nome em serifada
// ("Pinheiro · muda · 4 de 10"). `children` vai embaixo (régua de crescimento etc.).
import type { ReactNode } from 'react'
import styles from './Label.module.css'

interface LabelProps {
  kicker: string
  title: ReactNode
  children?: ReactNode
  className?: string
}

export function Label({ kicker, title, children, className }: LabelProps) {
  return (
    <div className={[styles.label, className].filter(Boolean).join(' ')}>
      <p className="kicker">{kicker}</p>
      <p className={styles.title}>{title}</p>
      {children}
    </div>
  )
}
