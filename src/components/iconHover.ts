// Liga um ícone do lucide-animated ao hover (e ao foco) de quem o contém: o botão inteiro
// anima o ícone, não só o pedacinho do ícone. Usado no Button e nos botões de carinho.
import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode, type Ref } from 'react'

/** O que os ícones do lucide-animated expõem pra animar por fora. */
interface AnimatedIcon {
  startAnimation: () => void
  stopAnimation: () => void
}

/** Liga o ícone ao hover do botão: o botão segura a ref e manda animar. */
export function useIconHover(icon: ReactNode) {
  // o setter do estado faz papel de ref de callback: o React entrega a alça quando o ícone monta
  const [handle, setHandle] = useState<AnimatedIcon | null>(null)
  const node = isValidElement(icon) ? cloneElement(icon as ReactElement<{ ref?: Ref<AnimatedIcon> }>, { ref: setHandle }) : icon
  return {
    node,
    hover: {
      onMouseEnter: () => handle?.startAnimation?.(),
      onMouseLeave: () => handle?.stopAnimation?.(),
      onFocus: () => handle?.startAnimation?.(),
      onBlur: () => handle?.stopAnimation?.(),
    },
  }
}
