import { useEffect, useState } from 'react'
import { getAuth, GoogleAuthProvider, linkWithPopup, onAuthStateChanged, signInAnonymously, signInWithPopup, type Auth, type User } from 'firebase/auth'
import {
  collection, doc, getDocs, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, serverTimestamp, setDoc, writeBatch, type Firestore,
} from 'firebase/firestore'
import { firebaseApp } from './firebase'
import { demoConcepts, demoEdges, slug } from './demo'

export { slug }
export type Status = 'known' | 'seen' | 'new'
export type Concept = { slug: string; name: string; summary: string; status: Status; mastery: number; seenCount: number; firstSeen: number; lastSeen: number }
/** from = prerequisite, to = concept that needs it */
export type Edge = { from: string; to: string }
export type Graph = { concepts: Record<string, Concept>; edges: Edge[]; from: 'demo' | 'cloud' | 'extension' }

let fb: { db: Firestore; auth: Auth } | null = null
function store() {
  const app = firebaseApp()
  if (!app) return null
  // offline-first cache, multi tab
  fb ??= { db: initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }), auth: getAuth(app) }
  return fb
}

// extension bridge: local graph lives in the extension
type Chrome = { runtime?: { sendMessage?: (id: string, msg: unknown, cb: (r: unknown) => void) => void; lastError?: unknown } }
function ext<T>(msg: { type: 'getGraph' } | { type: 'saveNode'; node: Concept; edges?: Edge[] }): Promise<T | null> {
  const id = process.env.NEXT_PUBLIC_EXTENSION_ID
  const c = (globalThis as { chrome?: Chrome }).chrome
  if (!id || !c?.runtime?.sendMessage) return Promise.resolve(null)
  return new Promise((res) => {
    try {
      c.runtime!.sendMessage!(id, msg, (r) => res(c.runtime?.lastError ? null : ((r as T) ?? null)))
    } catch {
      res(null)
    }
  })
}

/** Signed-in uid; anonymous fallback. */
async function uid() {
  const s = store()
  if (!s) return null
  await s.auth.authStateReady()
  return (s.auth.currentUser ?? (await signInAnonymously(s.auth)).user).uid
}

/** Google sign-in; links anon account so graph carries over. */
export async function signInGoogle() {
  const s = store()
  if (!s) return
  const p = new GoogleAuthProvider()
  const u = s.auth.currentUser
  try {
    await (u?.isAnonymous ? linkWithPopup(u, p) : signInWithPopup(s.auth, p))
  } catch {
    await signInWithPopup(s.auth, p) // google acct already exists → just sign in
  }
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    const s = store()
    return s ? onAuthStateChanged(s.auth, setUser) : undefined
  }, [])
  return user
}

const byId = (list: Concept[]) => Object.fromEntries(list.map((c) => [c.slug, c]))

async function load(): Promise<Graph> {
  const e = await ext<{ concepts: Concept[]; edges: Edge[] }>({ type: 'getGraph' })
  if (e) return { concepts: byId(e.concepts), edges: e.edges, from: 'extension' }
  const s = store()
  const u = await uid().catch(() => null)
  if (s && u) {
    try {
      const [c, ed] = await Promise.all([getDocs(collection(s.db, 'users', u, 'concepts')), getDocs(collection(s.db, 'users', u, 'edges'))])
      return { concepts: byId(c.docs.map((d) => ({ ...(d.data() as Concept), slug: d.id }))), edges: ed.docs.map((d) => d.data() as Edge), from: 'cloud' }
    } catch (err) {
      console.warn('graph load failed, demo data', err)
    }
  }
  return { concepts: byId(demoConcepts), edges: demoEdges, from: 'demo' }
}

async function persist(nodes: Concept[], edges: Edge[]) {
  for (const n of nodes) ext({ type: 'saveNode', node: n, edges: edges.filter((e) => e.to === n.slug) })
  const s = store()
  const u = await uid().catch(() => null)
  if (!s || !u) return
  const b = writeBatch(s.db)
  for (const n of nodes) b.set(doc(s.db, 'users', u, 'concepts', n.slug), { ...n, updatedAt: serverTimestamp() }, { merge: true })
  for (const e of edges) b.set(doc(s.db, 'users', u, 'edges', `${e.from}__${e.to}`), { ...e, updatedAt: serverTimestamp() })
  await b.commit().catch((err) => console.warn('graph save failed', err))
}

/** Save an issue breakdown (url + concept names only). */
export async function saveIssue(url: string, data: object) {
  const s = store()
  const u = await uid().catch(() => null)
  if (!s || !u) return
  await setDoc(doc(s.db, 'users', u, 'issues', slug(url.replace(/^https?:\/\/(www\.)?github\.com\//, ''))), { url, ...data, updatedAt: serverTimestamp() }).catch((err) =>
    console.warn('issue save failed', err),
  )
}

const fresh = (name: string, summary = ''): Concept => {
  const t = Date.now()
  return { slug: slug(name), name, summary, status: 'new', mastery: 0, seenCount: 0, firstSeen: t, lastSeen: t }
}

/** Personal graph state + writes (extension, firestore, or demo). */
export function useGraph() {
  const [g, setG] = useState<Graph | null>(null)
  useEffect(() => {
    load().then(setG)
  }, [])

  /** Record a concept you just read + its prereqs; viewing bumps new → seen. */
  const learn = (name: string, summary: string, prereqs: { name: string }[]) => {
    if (!g) return
    const s = slug(name)
    const old = g.concepts[s] ?? fresh(name, summary)
    const main: Concept = { ...old, summary: summary || old.summary, status: old.status === 'new' ? 'seen' : old.status, seenCount: old.seenCount + 1, lastSeen: Date.now() }
    const pre = prereqs.filter((p) => !g.concepts[slug(p.name)]).map((p) => fresh(p.name))
    const edges = prereqs.map((p) => ({ from: slug(p.name), to: s })).filter((e) => !g.edges.some((x) => x.from === e.from && x.to === e.to))
    setG({ ...g, concepts: { ...g.concepts, ...byId([main, ...pre]) }, edges: [...g.edges, ...edges] })
    persist([main, ...pre], edges)
  }

  const setStatus = (name: string, status: Status) => {
    if (!g) return
    const c = { ...(g.concepts[slug(name)] ?? fresh(name)), status, mastery: status === 'known' ? 0.9 : status === 'seen' ? 0.4 : 0 }
    setG({ ...g, concepts: { ...g.concepts, [c.slug]: c } })
    persist([c], [])
  }

  const status = (name: string): Status => g?.concepts[slug(name)]?.status ?? 'new'
  return { graph: g, learn, setStatus, status }
}
