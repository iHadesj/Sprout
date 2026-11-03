// Surpresa: a árvore velha com o entalhe aparece nos jardins de uma conta só.
//
// Quem decide é o dono do jardim (o nome de usuário dele), não o navegador:
// - ela vê a árvore nos jardins dela, em qualquer aparelho;
// - quem visita um jardim dela também vê (é o jardim dela);
// - nos jardins de qualquer outra pessoa, nada muda.
// Nada disso mexe em sessão, crescimento ou banco.
//
// Antes era um link (?ref=...) que marcava o navegador; isso vazava pra quem usasse o
// mesmo navegador com outra conta. O link antigo ainda funciona como link comum: o
// parâmetro some da barra e a marquinha velha é apagada.

const HER = 'nandinhaaamordoedu'
const OLD_PARAM = 'ref'
const OLD_KEY = 'sprout:ref'

/** Roda uma vez, antes do app montar: limpa o ?ref= e a marquinha do jeito antigo. */
export function captureSurpriseLink() {
  try {
    localStorage.removeItem(OLD_KEY)
    const url = new URL(window.location.href)
    if (url.searchParams.has(OLD_PARAM)) {
      url.searchParams.delete(OLD_PARAM)
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
  } catch {
    // sem armazenamento: nada pra limpar
  }
}

/** Esse jardim é dela? (pelo nome de usuário de quem é dono do jardim) */
export function isHers(username: string | null | undefined): boolean {
  return username?.toLowerCase() === HER
}
