'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import { Btn, Input, Label } from '@/components/ds'
import { Canvas, Dot, Legend, Sheet, SourceBadge, StatusPick, stage, type MapItem } from '@/components/map'
import { deepDive, explain, type Deep, type Explain, type Source } from '@/lib/ai'
import { learn, setStatus, slug, statusOf, useGraph, type Edge } from '@/lib/graph'

export default function Explore() {
  const term = (useSearchParams().get('concept') || 'closures').trim()
  // new concept → fresh map
  return <ConceptMap key={slug(term)} term={term} />
}

type Res = { data: Explain; source: Source }
type Link = Edge & { why: string }

function ConceptMap({ term }: { term: string }) {
  const root = slug(term)
  const router = useRouter()
  const g = useGraph()
  const [names, setNames] = useState<Record<string, string>>({ [root]: term })
  const [links, setLinks] = useState<Link[]>([])
  const [ex, setEx] = useState<Record<string, Res>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({ [root]: true })
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [deep, setDeep] = useState<Record<string, Deep | 'loading'>>({})
  const [sel, setSel] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')

  // nano explains; graph records it
  const fetchEx = (id: string, name: string) =>
    explain(name)
      .then((r) => {
        setEx((e) => ({ ...e, [id]: r }))
        learn(name, r.data.short, r.data.prerequisites)
        return r
      })
      .catch((e: unknown) => {
        setErr(e instanceof Error ? e.message : String(e))
        return null
      })
      .finally(() => setBusy((b) => ({ ...b, [id]: false })))

  // reveal prereqs under a node
  const grow = (id: string, r: Res) => {
    setOpen((o) => ({ ...o, [id]: true }))
    setNames((n) => {
      const m = { ...n }
      for (const p of r.data.prerequisites) m[slug(p.name)] ??= p.name
      return m
    })
    setLinks((l) => [
      ...l,
      ...r.data.prerequisites
        .map((p) => ({ from: slug(p.name), to: id, why: p.why }))
        .filter((x) => x.from !== id && !l.some((y) => y.from === x.from && y.to === x.to)),
    ])
  }

  const start = useEffectEvent(() => {
    fetchEx(root, term).then((r) => r && grow(root, r))
  })
  useEffect(() => start(), [])

  const select = (id: string | null) => {
    setSel(id)
    if (id && !ex[id] && !busy[id]) {
      setBusy((b) => ({ ...b, [id]: true }))
      fetchEx(id, names[id] ?? id)
    }
  }

  const dive = (id: string) => {
    setDeep((d) => ({ ...d, [id]: 'loading' }))
    deepDive(names[id] ?? id)
      .then((r) => setDeep((d) => ({ ...d, [id]: r })))
      .catch((e: unknown) => {
        setDeep((d) => ({ ...d, [id]: { text: `Deep dive failed: ${e instanceof Error ? e.message : e}`, sources: [] } }))
      })
  }

  const items: MapItem[] = Object.entries(names).map(([id, name]) => ({ id, name, status: statusOf(g, name), center: id === root, busy: busy[id] }))
  const rootRes = ex[root]
  const fresh = items.filter((i) => i.status === 'new').length

  return (
    <div className={stage}>
      <Canvas items={items} links={links} onSelect={select} />

      {/* overlays */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-4 md:p-6">
        <form
          className="pointer-events-auto flex w-full max-w-[360px] items-center gap-0"
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim()) router.push(`/explore?concept=${encodeURIComponent(q.trim())}`)
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a concept…" aria-label="Search concept" className="bg-card/90 backdrop-blur-sm" />
          <button type="submit" className="h-11 border border-l-0 border-input bg-card/90 px-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
            Go ↵
          </button>
        </form>
        <div className="pointer-events-auto flex items-center gap-3">{rootRes && <SourceBadge source={rootRes.source} />}</div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 z-10 flex flex-col gap-3 p-4 md:p-6">
        <AnimatePresence>
          {rootRes && (
            <motion.div
              initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto max-w-[380px] border border-border bg-card/90 p-4 backdrop-blur-sm"
            >
              <Label>{rootRes.data.term}</Label>
              <p className="mt-3 text-[15px] leading-relaxed">{rootRes.data.short}</p>
              <button onClick={() => select(root)} className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
                Read more →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-6">
          <Legend />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
            {items.length} nodes · {fresh} to learn
          </span>
        </div>
      </div>

      {err && (
        <div role="alert" className="absolute left-1/2 top-20 z-30 -translate-x-1/2 border border-destructive/40 bg-card px-4 py-2 font-mono text-[11px] text-destructive">
          {err} <button className="ml-3 underline" onClick={() => setErr('')}>dismiss</button>
        </div>
      )}

      <Sheet open={sel !== null} onClose={() => setSel(null)}>
        {sel && (
          <motion.div key={sel} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col">
            <Detail
              name={names[sel] ?? sel}
              res={ex[sel]}
              status={statusOf(g, names[sel] ?? sel)}
              why={links.filter((l) => l.from === sel).map((l) => [names[l.to] ?? l.to, l.why] as const)}
              deep={deep[sel]}
              opened={open[sel]}
              center={sel === root}
              onGrow={() => ex[sel] && grow(sel, ex[sel])}
              onDive={() => dive(sel)}
              onStatus={(s) => setStatus(names[sel] ?? sel, s)}
              statusOf={(n) => statusOf(g, n)}
            />
          </motion.div>
        )}
      </Sheet>
    </div>
  )
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-border px-6 py-5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-2.5">{children}</div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5 px-6 py-6">
      {[90, 100, 70, 85].map((w, i) => (
        <span key={i} className="pc-pulse h-3 bg-muted" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

function Detail(p: {
  name: string
  res?: Res
  status: ReturnType<typeof statusOf>
  why: (readonly [string, string])[]
  deep?: Deep | 'loading'
  opened?: boolean
  center: boolean
  onGrow: () => void
  onDive: () => void
  onStatus: (s: ReturnType<typeof statusOf>) => void
  statusOf: (n: string) => ReturnType<typeof statusOf>
}) {
  const d = p.res?.data
  return (
    <>
      <div className="border-b border-border px-6 pb-6 pt-14">
        <div className="flex items-center gap-3">
          <Dot status={p.status} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{p.center ? 'concept' : 'prerequisite'}</span>
          {p.res && <SourceBadge source={p.res.source} />}
        </div>
        <h2 className="mt-4 text-balance text-[34px] font-light leading-[1.05] tracking-[-0.03em]">{d?.term ?? p.name}</h2>
        {d && <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted-foreground">{d.short}</p>}
        <div className="mt-5">
          <StatusPick value={p.status} onChange={p.onStatus} />
        </div>
      </div>

      {!d ? (
        <Skeleton />
      ) : (
        <>
          <Block label="Explanation">
            <p className="text-pretty text-[15px] leading-relaxed">{d.explanation}</p>
          </Block>
          {p.why.length > 0 && (
            <Block label="Why you need it">
              <ul className="flex flex-col gap-2">
                {p.why.map(([parent, w]) => (
                  <li key={parent} className="text-[15px] leading-relaxed">
                    <span className="text-muted-foreground">For {parent}: </span>
                    {w}
                  </li>
                ))}
              </ul>
            </Block>
          )}
          {d.example && (
            <Block label="Example">
              <pre className="overflow-x-auto border border-border bg-card p-3 font-mono text-[12.5px] leading-relaxed">{d.example}</pre>
            </Block>
          )}
          {d.prerequisites.length > 0 && (
            <Block label={`Prerequisites · ${d.prerequisites.length}`}>
              <ul className="flex flex-col gap-1.5">
                {d.prerequisites.map((x) => (
                  <li key={x.name} className="flex items-center gap-2.5 text-sm">
                    <Dot status={p.statusOf(x.name)} />
                    {x.name}
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{p.statusOf(x.name)}</span>
                  </li>
                ))}
              </ul>
            </Block>
          )}
          <div className="flex flex-wrap gap-3 border-b border-border px-6 py-5">
            <Btn size="sm" onClick={p.onGrow} disabled={p.opened || d.prerequisites.length === 0}>
              {p.opened ? 'Expanded' : 'Go deeper'}
            </Btn>
            <Btn size="sm" variant="outline" onClick={p.onDive} disabled={p.deep === 'loading'}>
              Deep dive · cloud
            </Btn>
            {!p.center && (
              <Btn size="sm" variant="outline" href={`/explore?concept=${encodeURIComponent(p.name)}`}>
                Center
              </Btn>
            )}
          </div>
          {p.deep && (
            <Block label="Deep dive · grounded with Google Search">
              {p.deep === 'loading' ? (
                <span className="pc-blink font-mono text-[11px] uppercase tracking-wider text-live">Gemini is reading the web…</span>
              ) : (
                <>
                  <p className="whitespace-pre-line text-pretty text-[15px] leading-relaxed">{p.deep.text}</p>
                  {p.deep.sources.length > 0 && (
                    <ul className="mt-4 flex flex-col gap-1.5">
                      {p.deep.sources.map((s) => (
                        <li key={s.uri}>
                          <a href={s.uri} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                            ↗ {s.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Block>
          )}
        </>
      )}
    </>
  )
}
