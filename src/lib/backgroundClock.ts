// Intervalo que continua batendo com a aba em segundo plano.
// Com o Sprout atrás do VS Code, o Chrome freia os timers da aba: no máximo 1x por segundo
// e, depois de 5 min escondida, 1x por minuto. Isso atrasaria o fim do foco e, pior, o
// heartbeat (o servidor abandona a sessão com 90 s sem notícias). Timers de um Web Worker
// não sofrem esse freio, então o worker só bate o ritmo e a aba faz o trabalho.
// O worker é criado a partir de um texto (Blob), sem arquivo separado nem configuração no Vite.

const WORKER_SOURCE = `
const timers = new Map()
onmessage = (event) => {
  const { id, ms } = event.data
  clearInterval(timers.get(id))
  timers.delete(id)
  if (ms) timers.set(id, setInterval(() => postMessage(id), ms))
}
`

let worker: Worker | null | undefined
const callbacks = new Map<number, () => void>()
let nextId = 0

function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' })))
    worker.onmessage = (event: MessageEvent<number>) => callbacks.get(event.data)?.()
  } catch {
    worker = null // sem Worker (navegador antigo, teste): usa o setInterval comum
  }
  return worker
}

/** Como setInterval, mas sem freio em segundo plano. Devolve a função que para. */
export function setBackgroundInterval(callback: () => void, ms: number): () => void {
  const w = getWorker()
  if (!w) {
    const id = window.setInterval(callback, ms)
    return () => window.clearInterval(id)
  }
  const id = ++nextId
  callbacks.set(id, callback)
  w.postMessage({ id, ms })
  return () => {
    callbacks.delete(id)
    w.postMessage({ id, ms: 0 })
  }
}
