// Surpresa secreta: um link com cara de link comum marca o navegador de uma pessoa.
//
// Como funciona:
// 1. Ela abre o site uma vez com ?ref=<código> (ex.: https://seusite.vercel.app/?ref=yny93jv).
//    Parece um link de compartilhamento qualquer: nada no link diz que é pra ela.
// 2. O site guarda uma marquinha no navegador (localStorage) e tira o ?ref da barra de
//    endereço. Daí pra frente, naquele aparelho, isForHer() é true, mesmo pelo link comum.
// 3. ?ref=0 apaga a marquinha (útil se você testar no seu próprio celular).
//
// Os nomes de chave e parâmetro são neutros de propósito. Nada disso mexe em sessão,
// crescimento ou banco.

const PARAM = 'ref'
const CODE = 'yny93jv'
const RESET = '0'
const KEY = 'sprout:ref'

let forHer = false

/** Roda uma vez, antes do app montar: lê o ?ref= (se veio), guarda ou apaga a marquinha. */
export function captureSurpriseLink() {
  try {
    const url = new URL(window.location.href)
    const code = url.searchParams.get(PARAM)
    if (code === CODE) localStorage.setItem(KEY, code)
    if (code === RESET) localStorage.removeItem(KEY)
    if (code !== null) {
      url.searchParams.delete(PARAM)
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
    forHer = localStorage.getItem(KEY) === CODE
  } catch {
    forHer = false // sem armazenamento: Sprout normal
  }
}

/** Este navegador é o dela? */
export function isForHer(): boolean {
  return forHer
}
