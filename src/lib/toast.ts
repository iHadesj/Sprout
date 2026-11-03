// Avisos flutuantes: qualquer parte do app chama toast.success('...') ou toast.error('...').
// O <Toaster /> (src/components/Toaster.tsx) desenha a lista.
import { create } from 'zustand'

export interface Toast {
  id: number
  kind: 'success' | 'error'
  text: string
}

export const useToasts = create<{ list: Toast[] }>()(() => ({ list: [] }))
let nextId = 1

function push(kind: Toast['kind'], text: string) {
  const id = nextId++
  useToasts.setState((s) => ({ list: [...s.list.slice(-2), { id, kind, text }] }))
  window.setTimeout(() => useToasts.setState((s) => ({ list: s.list.filter((t) => t.id !== id) })), kind === 'error' ? 5000 : 3200)
}

export const toast = {
  success: (text: string) => push('success', text),
  error: (text: string) => push('error', text),
}
