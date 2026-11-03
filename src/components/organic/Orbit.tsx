// Itens soltos num arco (os chips embaixo da ilha, as cápsulas da revisão). É uma fileira
// normal (flex-wrap, a ordem do DOM é a de leitura e de Tab): cada item só desce e gira um
// pouco pra desenhar a curva. No celular o arco vira fileira com alturas alternadas.
import { Children, isValidElement, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { arc } from './curve'
import styles from './Orbit.module.css'

interface OrbitProps extends HTMLAttributes<HTMLDivElement> {
  /** quanto o meio desce em relação às pontas (px); negativo = arco pra cima */
  bend?: number
  /** giro máximo nas pontas (graus) */
  tilt?: number
  children: ReactNode
}

export function Orbit({ bend = 18, tilt = 4, className, style, children, ...rest }: OrbitProps) {
  const items = Children.toArray(children)
  return (
    <div className={[styles.orbit, className].filter(Boolean).join(' ')} style={{ paddingBottom: Math.max(0, bend), ...style }} {...rest}>
      {items.map((child, i) => {
        const { lift, angle } = arc(i, items.length, bend, tilt)
        const vars = { '--lift': `${lift}px`, '--tilt': `${angle}deg`, '--alt': i % 2 ? '10px' : '0px' } as CSSProperties
        return (
          <span key={isValidElement(child) && child.key != null ? child.key : i} className={styles.item} style={vars}>
            {child}
          </span>
        )
      })}
    </div>
  )
}
