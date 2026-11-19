// sw: msg hub + local graph (indexeddb) + counters
import { maxStatus, slugify, WEB_URL, type Concept, type Edge, type Explained, type Msg, type OffMsg, type Status } from './lib'

// --- tiny idb ---
const db = new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open('rabbit-hole', 1)
  r.onupgradeneeded = () => {
    r.result.createObjectStore('concepts', { keyPath: 'slug' })
    r.result.createObjectStore('edges', { keyPath: ['from', 'to'] })
  }
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})
const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((res, rej) => {
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
const os = async (name: 'concepts' | 'edges', mode: IDBTransactionMode = 'readonly') =>
  (await db).transaction(name, mode).objectStore(name)

const getConcept = async (slug: string) => req<Concept | undefined>((await os('concepts')).get(slug))

// merge into existing; seen bumps count
async function upsert(name: string, p: { summary?: string; status?: Status; seen?: boolean }) {
  const slug = slugify(name)
  if (!slug) return
  const s = await os('concepts', 'readwrite')
  const now = Date.now()
  const old = await req<Concept | undefined>(s.get(slug))
  const c: Concept = old ?? { slug, name, summary: '', status: 'new', seenCount: 0, firstSeen: now, lastSeen: now }
  if (p.summary) c.summary = p.summary
  if (p.status) c.status = maxStatus(c.status, p.status)
  if (p.seen) {
    c.status = maxStatus(c.status, 'seen')
    c.seenCount++
    c.lastSeen = now
  }
  await req(s.put(c))
}

async function getGraph(concept?: string) {
  const concepts = await req<Concept[]>((await os('concepts')).getAll())
  const edges = await req<Edge[]>((await os('edges')).getAll())
  if (!concept) return { concepts, edges }
  const slug = slugify(concept)
  const es = edges.filter((e) => e.from === slug || e.to === slug)
  const keep = new Set([slug, ...es.flatMap((e) => [e.from, e.to])])
  return { concepts: concepts.filter((c) => keep.has(c.slug)), edges: es }
}

// --- counters ---
async function bump(key: 'onDevice' | 'cloud') {
  const { [key]: n = 0 } = await chrome.storage.local.get(key)
  await chrome.storage.local.set({ [key]: (n as number) + 1 })
}

// --- offscreen ---
let creating: Promise<void> | undefined
async function offscreen<T>(m: OffMsg): Promise<T> {
  if (!(await chrome.offscreen.hasDocument())) {
    creating ??= chrome.offscreen
      .createDocument({
        url: 'offscreen.html',
        // no ai reason exists; dom ctx needed for LanguageModel + firebase
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'on-device AI (Prompt API) needs a DOM context',
      })
      .catch(() => {}) // lost race: doc already exists
      .finally(() => (creating = undefined))
    await creating
  }
  const r: { data?: T; error?: string } | undefined = await chrome.runtime.sendMessage(m)
  if (!r || r.error) throw new Error(r?.error ?? 'offscreen no reply')
  return r.data as T
}

async function explain(term: string): Promise<Explained> {
  const x = await offscreen<Omit<Explained, 'status'>>({ target: 'offscreen', type: 'explain', term })
  void bump(x.inferenceSource === 'IN_CLOUD' ? 'cloud' : 'onDevice')
  const statusOf = async (n: string) => (await getConcept(slugify(n)))?.status ?? 'new'
  // status before write: reflects what user knew
  const prerequisites = await Promise.all(x.prerequisites.map(async (p) => ({ ...p, status: await statusOf(p.name) })))
  const status = await statusOf(x.term)
  await upsert(x.term, { summary: x.short, seen: true })
  const es = await os('edges', 'readwrite')
  for (const p of x.prerequisites) if (slugify(p.name)) es.put({ from: slugify(p.name), to: slugify(x.term) })
  for (const p of x.prerequisites) await upsert(p.name, {})
  return { ...x, prerequisites, status }
}

async function extract(text: string) {
  const names = await offscreen<string[] | null>({ target: 'offscreen', type: 'extract', text })
  if (!names) return 0 // on-device unavailable: skip, never cloud
  void bump('onDevice')
  for (const n of names) await upsert(n, { seen: true })
  return names.length
}

chrome.runtime.onMessage.addListener((m: Msg | OffMsg, _s, reply) => {
  if ('target' in m) return // for offscreen
  const p =
    m.type === 'explain' ? explain(m.term) : m.type === 'markKnown' ? upsert(m.name, { status: 'known' }) : extract(m.text)
  p.then(
    (data) => reply({ data }),
    (e) => reply({ error: String(e?.message ?? e) }),
  )
  return true
})

// web app bridge. only our web origin may read graph
type ExtMsg = { type: 'getGraph'; concept?: string } | { type: 'saveNode'; name: string; summary?: string; status?: Status }
const STATUSES: Status[] = ['known', 'seen', 'new']
chrome.runtime.onMessageExternal.addListener((m: ExtMsg, sender, reply) => {
  if (sender.origin !== new URL(WEB_URL).origin) return reply({ error: 'forbidden origin' })
  const p =
    m?.type === 'getGraph'
      ? getGraph(typeof m.concept === 'string' ? m.concept : undefined)
      : m?.type === 'saveNode' && typeof m.name === 'string'
        ? upsert(m.name, {
            summary: typeof m.summary === 'string' ? m.summary : undefined,
            status: STATUSES.includes(m.status!) ? m.status : undefined,
          }).then(() => ({ ok: true }))
        : Promise.reject(new Error('bad message'))
  p.then(
    (data) => reply({ data }),
    (e) => reply({ error: String(e?.message ?? e) }),
  )
  return true
})
