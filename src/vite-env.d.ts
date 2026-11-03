/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /** Só em desenvolvimento: a cena 3D aberta, pra inspecionar no console e nos testes E2E. */
  __sprout3d?: { scene: import('three').Scene; gl: import('three').WebGLRenderer; camera: import('three').Camera }
  /** Só em desenvolvimento: o store do foco, pros testes E2E envelhecerem a sessão. */
  __sproutFocus?: typeof import('./stores/focusStore').useFocusStore
}
