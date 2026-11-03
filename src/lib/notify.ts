// Notificação do sistema pro fim do foco e da pausa: quem está no VS Code não vê a aba.
// A permissão é pedida no clique de "Começar foco" (o navegador só pergunta depois de um clique).
// Sem permissão, segue só com o sininho e o título da aba.

export function askNotifyPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') return
  Notification.requestPermission().catch(() => {})
}

export function notify(title: string, body: string) {
  // se a pessoa já está olhando pro Sprout, a tela dá conta do recado
  if (!('Notification' in window) || Notification.permission !== 'granted' || document.hasFocus()) return
  try {
    const notification = new Notification(title, { body, icon: '/favicon.svg', tag: 'sprout-focus' })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch {
    // alguns navegadores (Android) só notificam via service worker: fica o sininho
  }
}
