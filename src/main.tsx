import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/newsreader/standard.css'
import '@fontsource-variable/newsreader/standard-italic.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './styles/tokens.css'
import './styles/global.css'
import { App } from './app/App'
import { captureSurpriseLink, isForHer } from './features/surprise/surprise'

// antes do roteador: lê o ?ref= do link e limpa a barra de endereço
captureSurpriseLink()
// a fonte de letra de mão só é baixada no navegador marcado (usada no rabisco do cabeçalho)
if (isForHer()) void import('@fontsource/caveat/500.css')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
