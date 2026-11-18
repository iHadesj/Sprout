// A telinha de ajustar a foto de perfil: a foto aparece atrás de uma janela no formato da
// pedrinha do avatar, e dá pra arrastar (mouse ou dedo), dar zoom (roda, barrinha ou pinça
// com dois dedos) e, no teclado, mover com as setas e dar zoom com + e -.
// Ao salvar, o pedaço escolhido é redesenhado num canvas de 256 px: isso reduz a foto (de
// alguns MB pra dezenas de KB) e apaga os dados escondidos dela (EXIF, inclusive o GPS).
// A conta do corte fica no avatarCrop.ts.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Button } from '../../components/Button'
import { clampOffset, coverScale, MAX_ZOOM, OUTPUT_SIZE, sourceRect, WINDOW, zoomAt, type Offset } from './avatarCrop'
import styles from './AvatarCropper.module.css'

interface AvatarCropperProps {
  file: File
  busy: boolean
  onCancel: () => void
  onSave: (photo: Blob) => void
  /** a imagem não abriu (formato que o navegador não lê, como HEIC no Chrome) */
  onUnreadable: () => void
}

export function AvatarCropper({ file, busy, onCancel, onSave, onUnreadable }: AvatarCropperProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [view, setView] = useState(280)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const stage = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, Offset>())
  // o estado mais recente, pra roda do mouse (o listener é nativo, criado uma vez)
  const latest = useRef({ zoom, offset, image, view })
  useLayoutEffect(() => {
    latest.current = { zoom, offset, image, view }
  })

  // abre a foto escolhida
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    // depois de desfeito (o React desfaz e refaz o efeito em desenvolvimento), o link já foi
    // revogado e a imagem falha: esse erro não é da foto, então é ignorado
    let live = true
    img.onload = () => live && setImage(img)
    img.onerror = () => live && onUnreadable()
    img.src = url
    return () => {
      live = false
      URL.revokeObjectURL(url)
    }
  }, [file, onUnreadable])

  // tamanho da janela na tela (ela encolhe em tela estreita)
  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => setView(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const size = image ? { width: image.naturalWidth, height: image.naturalHeight } : null

  /** Ponto do evento relativo ao centro da janela. */
  const fromCenter = (clientX: number, clientY: number): Offset => {
    const r = stage.current!.getBoundingClientRect()
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 }
  }

  // roda do mouse: zoom em volta do cursor. Listener nativo pra poder impedir a página de rolar.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const wheel = (event: WheelEvent) => {
      const { image: img, zoom: z, offset: o, view: v } = latest.current
      if (!img) return
      event.preventDefault()
      const next = zoomAt(o, z, z * Math.exp(-event.deltaY * 0.0015), fromCenter(event.clientX, event.clientY), { width: img.naturalWidth, height: img.naturalHeight }, v)
      setZoom(next.zoom)
      setOffset(next.offset)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const map = pointers.current
    const before = map.get(event.pointerId)
    if (!before || !size) return
    const now = { x: event.clientX, y: event.clientY }
    if (map.size === 1) {
      // um dedo (ou o mouse): arrasta
      setOffset((o) => clampOffset({ x: o.x + now.x - before.x, y: o.y + now.y - before.y }, size, view, zoom))
    } else if (map.size === 2) {
      // dois dedos: pinça. O zoom segue a distância entre eles, em volta do meio deles.
      const other = [...map.entries()].find(([id]) => id !== event.pointerId)![1]
      const ratio = Math.hypot(now.x - other.x, now.y - other.y) / Math.max(1, Math.hypot(before.x - other.x, before.y - other.y))
      const middle = fromCenter((now.x + other.x) / 2, (now.y + other.y) / 2)
      const next = zoomAt(offset, zoom, zoom * ratio, middle, size, view)
      setZoom(next.zoom)
      setOffset(next.offset)
    }
    map.set(event.pointerId, now)
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
  }

  function zoomTo(value: number) {
    if (!size) return
    const next = zoomAt(offset, zoom, value, { x: 0, y: 0 }, size, view)
    setZoom(next.zoom)
    setOffset(next.offset)
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!size) return
    const step = event.shiftKey ? 40 : 10
    const moves: Record<string, Offset> = { ArrowLeft: { x: step, y: 0 }, ArrowRight: { x: -step, y: 0 }, ArrowUp: { x: 0, y: step }, ArrowDown: { x: 0, y: -step } }
    if (moves[event.key]) {
      event.preventDefault()
      setOffset((o) => clampOffset({ x: o.x + moves[event.key].x, y: o.y + moves[event.key].y }, size, view, zoom))
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomTo(zoom * 1.1)
    } else if (event.key === '-') {
      event.preventDefault()
      zoomTo(zoom / 1.1)
    }
  }

  async function save() {
    if (!image || !size) return
    // o avatar é o que está dentro da janela (a pedrinha), não o quadro inteiro
    onSave(await renderAvatar(image, sourceRect(size, view, zoom, offset, view * WINDOW)))
  }

  const scale = size ? coverScale(size, view) * zoom : 1

  return (
    <div className={styles.cropper}>
      <div
        ref={stage}
        className={styles.stage}
        tabIndex={0}
        role="application"
        aria-label="Ajuste da foto: arraste pra mover, use a roda ou os dedos pra dar zoom. No teclado, setas movem e + e - dão zoom."
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onKeyDown={keyDown}
        data-loading={!image || undefined}
      >
        {image && size && (
          <img
            src={image.src}
            alt=""
            draggable={false}
            className={styles.photo}
            style={{
              width: size.width * scale,
              height: size.height * scale,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            }}
          />
        )}
        {/* a janela: fora dela o papel cobre a foto, dentro é o que vira o avatar */}
        <div className={styles.hole} aria-hidden="true" />
      </div>

      <label className={styles.zoom}>
        <span>Zoom</span>
        <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} disabled={!image} onChange={(e) => zoomTo(Number(e.target.value))} />
      </label>

      <div className={styles.actions}>
        <Button variant="quiet" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button onClick={save} busy={busy} disabled={!image}>
          Salvar foto
        </Button>
      </div>
    </div>
  )
}

/**
 * Desenha o pedaço escolhido num quadrado de 256 px. Reduzir de uma vez (3000 px pra 256)
 * serrilha a imagem; reduzir pela metade várias vezes mantém a foto lisa.
 * WebP quando o navegador sabe gerar; senão (Safari antigo), JPEG.
 */
async function renderAvatar(image: HTMLImageElement, rect: { x: number; y: number; size: number }): Promise<Blob> {
  let source: CanvasImageSource = image
  let sx = rect.x
  let sy = rect.y
  let side = rect.size
  while (side / 2 >= OUTPUT_SIZE * 1.5) {
    const half = Math.round(side / 2)
    const step = document.createElement('canvas')
    step.width = step.height = half
    const ctx = step.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, sx, sy, side, side, 0, 0, half, half)
    source = step
    sx = sy = 0
    side = half
  }
  const out = document.createElement('canvas')
  out.width = out.height = OUTPUT_SIZE
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  const blob = (type: string, quality: number) => new Promise<Blob | null>((resolve) => out.toBlob(resolve, type, quality))
  const webp = await blob('image/webp', 0.86)
  if (webp && webp.type === 'image/webp') return webp
  const jpeg = await blob('image/jpeg', 0.88)
  if (!jpeg) throw new Error('Não deu pra preparar a foto.')
  return jpeg
}
