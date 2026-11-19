// content: chip + tooltip (shadow dom), alt-hover, bg extraction, github button
import { isTechPage, isTerm, slugify, WEB_URL, type Explained, type Msg, type Source } from './lib'

const send = async <T>(m: Msg): Promise<T> => {
  const r = await chrome.runtime.sendMessage(m)
  if (!r || r.error) throw new Error(r?.error ?? 'no reply')
  return r.data as T
}

// tiny dom builder. textContent only: model output never hits innerHTML
const h = (tag: string, cls = '', text = '') => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text) e.textContent = text
  return e
}

const MONO = `'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace`
const CSS = `
*{box-sizing:border-box;margin:0}
[hidden]{display:none!important}
.chip,.card{position:absolute;background:#111;color:#e8e4dc;border:1px solid #292929;border-radius:0}
.chip{width:22px;height:22px;padding:0;font:600 12px/1 ${MONO};cursor:pointer;transition:color .15s,border-color .15s}
.chip:hover,.btn:hover{border-color:#8fb0f5;color:#8fb0f5}
.card{width:320px;max-height:min(440px,calc(100vh - 16px));overflow:auto;padding:14px;font:14px/1.5 Geist,ui-sans-serif,system-ui,-apple-system,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.label,.badge,.btn{font:500 11px/1 ${MONO};text-transform:uppercase;letter-spacing:.08em}
.label{color:#9a958d}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.badge{color:#9a958d;border:1px solid #292929;padding:3px 5px}
.badge.live{color:#8fb0f5;border-color:#8fb0f5}
.term{font-size:16px;font-weight:600;margin-bottom:6px}
.short{margin-bottom:6px}
.muted{color:#9a958d;font-size:13px}
ul{list-style:none;padding:0;margin:8px 0 14px}
li{display:grid;grid-template-columns:8px 1fr;gap:2px 10px;padding:6px 0;border-top:1px solid #292929}
li small{grid-column:2;color:#9a958d;font-size:12px;line-height:1.4}
.dot{width:7px;height:7px;margin-top:7px;border:1px solid #9a958d}
.dot.known{background:#8fb0f5;border-color:#8fb0f5}
.dot.seen{background:#9a958d}
.actions{display:flex;gap:8px;margin-top:12px}
.btn{flex:1;background:transparent;color:#e8e4dc;border:1px solid #292929;border-radius:0;padding:8px;cursor:pointer;transition:color .15s,border-color .15s}
.btn.primary{color:#8fb0f5;border-color:#8fb0f5}
.sh{height:10px;margin:10px 0;background:linear-gradient(90deg,#1a1a1a,#2a2a2a,#1a1a1a);background-size:200% 100%;animation:sh 1.2s linear infinite}
@keyframes sh{to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`

const host = h('rabbit-hole')
host.style.cssText = 'all:initial;position:fixed;left:0;top:0;z-index:2147483647'
const root = host.attachShadow({ mode: 'closed' })
const style = h('style', '', CSS)
const chip = h('button', 'chip', '?')
const card = h('div', 'card')
chip.hidden = card.hidden = true
chip.title = 'Explain with Rabbit Hole'
root.append(style, chip, card)
document.documentElement.append(host)

const inside = (e: Event) => e.composedPath().includes(host)
const motion = (el: HTMLElement) =>
  el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 160, easing: 'ease-out' })

let chipTerm = ''
let chipRect: DOMRect | undefined
let openTerm = ''
let seq = 0

function close() {
  chip.hidden = card.hidden = true
  openTerm = ''
  seq++
}

// below anchor, flip above if no room
function place(r: DOMRect) {
  card.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 328))}px`
  const below = r.bottom + 8
  card.style.top = `${below + card.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - 8 - card.offsetHeight) : below}px`
}

const SRC: Record<Source, string> = { ON_DEVICE: 'On-device', PROMPT_API: 'On-device · Prompt API', IN_CLOUD: 'Cloud' }

function render(term: string, x?: Explained, err?: string) {
  const top = h('div', 'top')
  top.append(h('span', 'label', 'Rabbit Hole'))
  if (x) top.append(h('span', x.inferenceSource === 'IN_CLOUD' ? 'badge' : 'badge live', SRC[x.inferenceSource]))
  const body: HTMLElement[] = [top, h('div', 'term', x?.term || term)]
  if (err) body.push(h('p', 'muted', `Couldn't explain: ${err}`))
  else if (!x) body.push(h('div', 'sh'), h('div', 'sh'), h('div', 'sh'))
  else {
    body.push(h('p', 'short', x.short), h('p', 'muted', x.explanation))
    if (x.prerequisites.length) {
      const ul = h('ul')
      for (const p of x.prerequisites) {
        const li = h('li')
        const dot = h('i', `dot ${p.status}`)
        dot.title = p.status
        li.append(dot, h('span', '', p.name), h('small', '', p.why))
        ul.append(li)
      }
      body.push(h('div', 'label', 'Prerequisites'), ul)
    }
    const acts = h('div', 'actions')
    const deeper = h('button', 'btn primary', 'Go deeper')
    deeper.onclick = () => window.open(`${WEB_URL}/explore?concept=${encodeURIComponent(slugify(x.term))}`, '_blank')
    const known = h('button', 'btn', x.status === 'known' ? 'Known' : 'Mark known')
    known.onclick = () => send({ type: 'markKnown', name: x.term }).then(() => (known.textContent = 'Known'))
    acts.append(deeper, known)
    body.push(acts)
  }
  card.replaceChildren(...body)
}

async function open(term: string, r: DOMRect) {
  const id = ++seq
  openTerm = term
  chip.hidden = true
  render(term)
  card.hidden = false
  place(r)
  motion(card)
  try {
    const x = await send<Explained>({ type: 'explain', term })
    if (id === seq) render(term, x)
  } catch (e) {
    if (id === seq) render(term, undefined, (e as Error).message)
  }
  if (id === seq) place(r)
}

// selection -> chip
document.addEventListener('mouseup', (e) => {
  if (inside(e)) return
  setTimeout(() => {
    const sel = getSelection()
    const t = sel?.toString().trim() ?? ''
    if (!sel?.rangeCount || !isTerm(t)) return void (chip.hidden = true)
    chipTerm = t
    chipRect = sel.getRangeAt(0).getBoundingClientRect()
    chip.style.left = `${Math.min(chipRect.right + 4, innerWidth - 30)}px`
    chip.style.top = `${Math.max(4, chipRect.top - 26)}px`
    chip.hidden = false
    motion(chip)
  })
})
chip.addEventListener('click', () => chipRect && open(chipTerm, chipRect))
document.addEventListener('mousedown', (e) => !inside(e) && close())
document.addEventListener('keydown', (e) => e.key === 'Escape' && close())
addEventListener('scroll', () => (chip.hidden = true), { passive: true })

// alt+hover word
let hoverT: ReturnType<typeof setTimeout> | undefined
document.addEventListener('mousemove', (e) => {
  clearTimeout(hoverT)
  if (!e.altKey || inside(e)) return
  hoverT = setTimeout(() => {
    const pos = document.caretPositionFromPoint?.(e.clientX, e.clientY)
    const node = pos?.offsetNode
    if (!node || node.nodeType !== Node.TEXT_NODE) return
    const text = node.textContent ?? ''
    for (const m of text.matchAll(/[\w#+.-]+/g)) {
      const s = m.index, end = s + m[0].length
      if (pos.offset < s || pos.offset > end) continue
      const word = m[0].replace(/[.-]+$/, '')
      if (!isTerm(word) || word === openTerm) return
      const r = document.createRange()
      r.setStart(node, s)
      r.setEnd(node, s + word.length)
      return void open(word, r.getBoundingClientRect())
    }
  }, 350)
})

// bg extraction: tech pages only, once per load, after idle
if (isTechPage(location.hostname, document.querySelectorAll('pre').length)) {
  setTimeout(
    () =>
      requestIdleCallback(
        () => {
          const text = ((document.querySelector('main, article, [role=main]') ?? document.body) as HTMLElement).innerText
          if (text.length > 200) send({ type: 'extract', text: text.slice(0, 6000) }).catch(() => {})
        },
        { timeout: 10000 },
      ),
    3000,
  )
}

// github issue button. ponytail: poll for spa nav, MutationObserver if it lags
if (location.hostname === 'github.com') {
  setInterval(() => {
    if (!/^\/[^/]+\/[^/]+\/issues\/\d+/.test(location.pathname) || document.getElementById('rh-dive')) return
    const title = document.querySelector('[data-testid="issue-title"], .js-issue-title')
    const h1 = title?.closest('h1') ?? title
    if (!h1) return
    const b = h('button', '', 'Dive with Rabbit Hole')
    b.id = 'rh-dive'
    b.style.cssText = `margin-left:12px;vertical-align:middle;padding:3px 12px;font:500 12px/20px -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif;color:var(--button-default-fgColor-rest,#25292e);background:var(--button-default-bgColor-rest,#f6f8fa);border:1px solid var(--button-default-borderColor-rest,rgba(31,35,40,.15));border-radius:6px;cursor:pointer`
    // read url at click: header may persist across spa nav
    b.onclick = () =>
      window.open(`${WEB_URL}/issue?url=${encodeURIComponent(location.origin + location.pathname)}`, '_blank')
    h1.append(b)
  }, 1500)
}
