// Um AudioContext só pro app inteiro: o sininho do fim e o som ambiente do foco dividem ele.
// O navegador só libera áudio depois de um clique — por isso `primeAudio` roda no "Começar foco".
// Sem Web Audio (ou com o áudio bloqueado), tudo segue em silêncio, sem quebrar nada.

let context: AudioContext | null = null

/** Chamado num clique: cria (ou retoma) o contexto. Devolve null se o navegador não deixar. */
export function primeAudio(): AudioContext | null {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

/** O contexto, só se já estiver tocando (liberado por um clique). */
export function audio(): AudioContext | null {
  return context?.state === 'running' ? context : null
}
