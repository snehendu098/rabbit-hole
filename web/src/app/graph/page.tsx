'use client'

import { motion } from 'motion/react'
import { useState } from 'react'
import { Badge, Btn, Frame, Label } from '@/components/ds'
import { AppNav, Canvas, Dot, Sheet, StatusPick, stage } from '@/components/map'
import { setStatus, useGraph, type Status } from '@/lib/graph'
import { cn } from '@/lib/utils'

const filters = ['all', 'known', 'seen', 'new'] as const
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 6e4)
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
}

export default function GraphPage() {
  const g = useGraph()
  const [f, setF] = useState<(typeof filters)[number]>('all')
  const [sel, setSel] = useState<string | null>(null)

  const all = Object.values(g?.concepts ?? {})
  const shown = all.filter((c) => f === 'all' || c.status === f)
  const ids = new Set(shown.map((c) => c.slug))
  const links = (g?.edges ?? []).filter((e) => ids.has(e.from) && ids.has(e.to))
  const count = (s: Status) => all.filter((c) => c.status === s).length
  const c = sel ? g?.concepts[sel] : undefined
  const name = (s: string) => g?.concepts[s]?.name ?? s

  return (
    <Frame nav={<AppNav />}>
      <div className={stage}>
        {g && shown.length > 0 ? (
          <Canvas items={shown.map((x) => ({ id: x.slug, name: x.name, status: x.status }))} links={links} onSelect={setSel} />
        ) : (
          <div className="pc-dots grid h-full place-items-center">
            <span className={cn('font-mono text-[11px] uppercase tracking-wider text-muted-foreground', !g && 'pc-blink')}>
              {g ? 'Nothing here yet. Explore a concept to start your graph.' : 'Loading your graph…'}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-4 p-4 md:p-6">
          <div className="pointer-events-auto flex flex-col gap-4 border border-border bg-card/90 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Label>Your knowledge graph</Label>
              {g && <Badge tone={g.from === 'demo' ? 'muted' : 'live'}>{g.from}</Badge>}
            </div>
            <div className="flex gap-8">
              {(['known', 'seen', 'new'] as const).map((s) => (
                <div key={s} className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Dot status={s} />
                    {s}
                  </span>
                  <span className="text-3xl font-light tabular-nums tracking-[-0.03em]">{count(s)}</span>
                </div>
              ))}
            </div>
          </div>
          <div role="radiogroup" aria-label="Filter by status" className="pointer-events-auto grid grid-cols-4 border border-border bg-card/90 backdrop-blur-sm">
            {filters.map((x) => (
              <button
                key={x}
                role="radio"
                aria-checked={f === x}
                onClick={() => setF(x)}
                className={cn('relative h-9 border-r border-border px-4 font-mono text-[11px] uppercase tracking-wider transition-colors last:border-r-0', f === x ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {f === x && <motion.span layoutId="filter" className="absolute inset-0 bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                <span className="relative">{x}</span>
              </button>
            ))}
          </div>
        </div>

        <Sheet open={!!c} onClose={() => setSel(null)}>
          {c && (
            <motion.div key={c.slug} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="border-b border-border px-6 pb-6 pt-14">
                <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Dot status={c.status} />
                  {c.status} · seen {c.seenCount}× · {ago(c.lastSeen)}
                </span>
                <h2 className="mt-4 text-[34px] font-light leading-[1.05] tracking-[-0.03em]">{c.name}</h2>
                {c.summary && <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted-foreground">{c.summary}</p>}
                <div className="mt-5">
                  <StatusPick value={c.status} onChange={(s) => setStatus(c.name, s)} />
                </div>
              </div>
              {(
                [
                  ['Needs', (g?.edges ?? []).filter((e) => e.to === c.slug).map((e) => e.from)],
                  ['Needed by', (g?.edges ?? []).filter((e) => e.from === c.slug).map((e) => e.to)],
                ] as const
              ).map(
                ([k, list]) =>
                  list.length > 0 && (
                    <div key={k} className="border-b border-border px-6 py-5">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k}</span>
                      <ul className="mt-2.5 flex flex-col gap-1.5">
                        {list.map((s) => (
                          <li key={s}>
                            <button onClick={() => setSel(s)} className="flex w-full items-center gap-2.5 text-left text-sm transition-colors hover:text-foreground">
                              <Dot status={g?.concepts[s]?.status ?? 'new'} />
                              {name(s)}
                              <span className="ml-auto font-mono text-[10px] text-muted-foreground">→</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
              )}
              <div className="px-6 py-5">
                <Btn size="sm" href={`/explore?concept=${encodeURIComponent(c.name)}`}>
                  Open in explore
                </Btn>
              </div>
            </motion.div>
          )}
        </Sheet>
      </div>
    </Frame>
  )
}
