// Surpresa: a árvore velha com o entalhe "E + F" aparece nos jardins de duas contas, a dele e
// a dela, pelo id do usuário (o id nunca muda; o nome de usuário pode mudar).
//
// Quem decide é o dono do jardim, não quem está olhando nem o navegador:
// - nos jardins dele e nos dela, a árvore aparece pra quem olhar (os dois, ou um amigo visitando);
// - nos jardins de qualquer outra pessoa, nada muda.
// Nada disso mexe em sessão, crescimento ou banco.
//
// Antes era um link (?ref=...) que marcava o navegador, e depois o nome de usuário dela. O link
// antigo ainda funciona como link comum: o parâmetro some da barra e a marquinha velha é apagada.

/** ids (auth.users / profiles) das duas contas */
const OURS = new Set<string>([
  'e186f8e3-25da-4ad2-8e63-69cb984807b9', // Edu
  '9771cbb7-3c6a-471e-939c-404857af3244', // Nanda
])

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

/** Esse jardim é de um de vocês dois? (pelo id de quem é dono do jardim) */
export function isOurs(ownerId: string | null | undefined): boolean {
  return !!ownerId && OURS.has(ownerId)
}
