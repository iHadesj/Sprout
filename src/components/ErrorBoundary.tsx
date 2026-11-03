// Se algo dentro dele quebrar (ex.: a cena 3D perder o WebGL), mostra `fallback`
// em vez de derrubar a tela inteira. Error boundary ainda precisa ser classe no React.
import { Component, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('Parte da tela falhou e foi trocada por uma versão simples:', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
