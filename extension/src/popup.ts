// popup: status, model download (needs user gesture), counters
import { LM_OPTS, WEB_URL } from './lib'

const $ = (id: string) => document.getElementById(id)!
const status = $('status')
const enable = $('enable') as HTMLButtonElement
;($('web') as HTMLAnchorElement).href = `${WEB_URL}/explore`

chrome.storage.local.get(['onDevice', 'cloud']).then((c) => {
  $('onDevice').textContent = String(c.onDevice ?? 0)
  $('cloud').textContent = String(c.cloud ?? 0)
})

async function refresh() {
  const a = (await globalThis.LanguageModel?.availability(LM_OPTS)) ?? 'unsupported'
  status.textContent = a
  status.className = a === 'available' ? 'live' : ''
  enable.hidden = a !== 'downloadable' && a !== 'downloading'
}

// create() in click handler = user activation -> triggers download.
// model is per-profile, offscreen doc reuses it
enable.onclick = async () => {
  enable.disabled = true
  try {
    const s = await LanguageModel!.create({
      ...LM_OPTS,
      monitor: (m: EventTarget) =>
        m.addEventListener('downloadprogress', (e) => {
          status.textContent = `${Math.round((e as ProgressEvent).loaded * 100)}%`
        }),
    })
    s.destroy()
  } catch (e) {
    status.textContent = 'failed'
    console.warn('[rh] download failed', e)
  }
  enable.disabled = false
  await refresh()
}

void refresh()
