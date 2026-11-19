'use client'

import { motion } from 'motion/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useEffectEvent, useState } from 'react'
import { Btn, Index, Input, Item, Label, Mark, Panel, Reveal, Rule, Spotlight, Stagger } from '@/components/ds'
import { Dot, Legend } from '@/components/map'
import { breakdown, type Issue } from '@/lib/ai'
import { hasFirebase } from '@/lib/firebase'
import { saveIssue, statusOf, useGraph } from '@/lib/graph'

const pad = 'px-6 md:px-12 lg:px-16'
const SAMPLE = 'https://github.com/facebook/react/issues/14010'
// trust boundary: only github issue urls go to the model
const issueRe = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/(\d+)\/?$/
const go = (u: string) => `/issue?url=${encodeURIComponent(u)}`

export default function IssueView() {
  const url = (useSearchParams().get('url') ?? '').trim()
  return url ? <Breakdown key={url} url={url} /> : <Ask />
}

function Ask({ error }: { error?: string }) {
  const router = useRouter()
  const [v, setV] = useState('')
  const bad = v.trim() !== '' && !issueRe.test(v.trim())
  return (
    <Spotlight className="min-h-[calc(100svh-57px)]">
      <Stagger delay={0.1} className={`mx-auto flex max-w-[860px] flex-col gap-10 py-24 md:py-36 ${pad}`}>
        <Item>
          <Label>GitHub issue mode</Label>
        </Item>
        <Item>
          <h1 className="text-[clamp(40px,5vw,84px)] font-light leading-[0.96] tracking-[-0.05em]">
            Paste an issue. <br />
            <span className="text-muted-foreground">Get a way in.</span>
          </h1>
          <p className="mt-8 max-w-[52ch] text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            A plain-words breakdown, the files to read, the prerequisites marked against your graph and a path that skips what you know. Only the URL and concept
            names leave your device.
          </p>
        </Item>
        <Item>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              if (issueRe.test(v.trim())) router.push(go(v.trim()))
            }}
          >
            <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="https://github.com/owner/repo/issues/123" aria-label="GitHub issue URL" aria-invalid={bad} />
            <Btn type="submit" disabled={!issueRe.test(v.trim())} className="shrink-0">
              Break it down
            </Btn>
          </form>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className={bad || error ? 'text-destructive' : ''}>{error ?? (bad ? 'Needs a github.com/…/issues/N url' : 'URL context + Google Search · cloud')}</span>
            <button type="button" onClick={() => router.push(go(SAMPLE))} className="transition-colors hover:text-foreground">
              Try a sample →
            </button>
          </div>
        </Item>
      </Stagger>
    </Spotlight>
  )
}

const phases = ['Reading the issue · url context', 'Searching the web · google search', 'Matching against your graph']

function Loading() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((k) => Math.min(k + 1, phases.length - 1)), 1600)
    return () => clearInterval(id)
  }, [])
  return (
    <Spotlight className="grid min-h-[calc(100svh-57px)] place-items-center">
      <ul className="flex flex-col gap-3 font-mono text-[11px] uppercase tracking-wider">
        {phases.map((p, i) => (
          <motion.li key={p} initial={{ opacity: 0, x: -8 }} animate={{ opacity: i <= n ? 1 : 0.3, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-3">
            <span className={i < n ? 'text-foreground' : i === n ? 'pc-blink text-live' : 'text-muted-foreground'}>{i < n ? '✓' : '■'}</span>
            <span className={i <= n ? 'text-foreground' : 'text-muted-foreground'}>{p}</span>
          </motion.li>
        ))}
      </ul>
    </Spotlight>
  )
}

function Breakdown({ url }: { url: string }) {
  const g = useGraph()
  const m = url.match(issueRe)
  const [data, setData] = useState<Issue | null>(null)
  const [err, setErr] = useState('')

  // effect event sees latest graph
  const run = useEffectEvent(() => {
    if (!g || !m) return
    const known = Object.values(g.concepts).filter((c) => c.status === 'known').map((c) => c.name)
    breakdown(url, known)
      .then((d) => {
        setData(d)
        saveIssue(url, { title: d.title, prerequisites: d.prerequisites.map((p) => p.name) })
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
  })
  // wait for graph so known concepts personalize the path
  const ready = !!g
  useEffect(() => {
    if (ready) run()
  }, [ready])

  if (!m) return <Ask error="Not a GitHub issue URL" />
  if (err) return <Ask error={`Breakdown failed: ${err}`} />
  if (!data) return <Loading />

  const known = data.prerequisites.filter((p) => statusOf(g, p.name) === 'known').length
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* head */}
        <section className="grid lg:grid-cols-[7fr_5fr]">
          <Stagger delay={0.05} className={`flex flex-col gap-8 py-16 md:py-24 ${pad}`}>
            <Item className="flex flex-wrap items-center gap-4">
              <Label>{m[1]} · #{m[2]}</Label>
              {!hasFirebase && <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">sample breakdown · demo data</span>}
            </Item>
            <Item>
              <h1 className="text-balance text-[clamp(36px,4.2vw,72px)] font-light leading-[1] tracking-[-0.04em]">{data.title}</h1>
            </Item>
            <Item>
              <p className="max-w-[60ch] text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">{data.summary}</p>
            </Item>
            <Item className="flex flex-wrap gap-3">
              <Btn href={`/explore?concept=${encodeURIComponent(data.prerequisites[0]?.name ?? 'closures')}`}>Start learning</Btn>
              <Btn href={url} variant="outline">Open on GitHub</Btn>
            </Item>
          </Stagger>
          <Spotlight className="flex flex-col justify-center gap-6 border-t border-border bg-card px-6 py-12 md:px-12 lg:border-l lg:border-t-0">
            <Label>You vs this issue</Label>
            <div className="flex items-end gap-3">
              <span className="text-[clamp(56px,6vw,96px)] font-light leading-none tracking-[-0.05em] tabular-nums">
                {known}/{data.prerequisites.length}
              </span>
              <span className="pb-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">prerequisites known</span>
            </div>
            <div className="flex h-1.5 w-full gap-px">
              {data.prerequisites.map((p) => (
                <motion.span key={p.name} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6 }} className="origin-left flex-1">
                  <Dot status={statusOf(g, p.name)} className="block h-full w-full" />
                </motion.span>
              ))}
            </div>
            <Legend />
          </Spotlight>
        </section>

        <Rule />

        {/* prereqs + files */}
        <section className="grid lg:grid-cols-2">
          <div className={`py-12 md:py-16 ${pad}`}>
            <div className="flex items-center gap-6">
              <Index n={1} />
              <Mark>Prerequisites</Mark>
            </div>
            <Stagger inView gap={0.06} className="mt-8 flex flex-col border-t border-border">
              {data.prerequisites.map((p) => {
                const s = statusOf(g, p.name)
                return (
                  <Item key={p.name} className="group flex items-start gap-4 border-b border-border py-4">
                    <Dot status={s} className="mt-2" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg tracking-tight">{p.name}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s === 'known' ? 'known · skip' : s}</span>
                      </div>
                      <p className="mt-1 text-pretty text-[15px] leading-relaxed text-muted-foreground">{p.why}</p>
                    </div>
                    <Btn size="sm" variant="outline" href={`/explore?concept=${encodeURIComponent(p.name)}`} className="shrink-0">
                      Explore
                    </Btn>
                  </Item>
                )
              })}
            </Stagger>
          </div>
          <div className={`border-t border-border py-12 md:py-16 lg:border-l lg:border-t-0 ${pad}`}>
            <div className="flex items-center gap-6">
              <Index n={2} />
              <Mark>Files to read</Mark>
            </div>
            <Reveal className="mt-8">
              <Panel title="Read in this order" aside={<span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{data.files.length} files</span>} bodyClassName="p-0">
                <ol>
                  {data.files.map((f, i) => (
                    <li key={f.path} className="flex gap-4 border-b border-border px-4 py-3.5 last:border-b-0">
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">0{i + 1}</span>
                      <div className="min-w-0">
                        <code className="block truncate font-mono text-[13px]">{f.path}</code>
                        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{f.why}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Panel>
            </Reveal>
          </div>
        </section>

        <Rule />

        {/* path */}
        <section>
          <div className={`flex h-14 items-center gap-6 border-b border-border ${pad}`}>
            <Index n={3} />
            <Mark>Your learning path</Mark>
          </div>
          <Stagger inView gap={0.1} className="grid md:grid-cols-2 lg:grid-cols-4">
            {data.path.map((s, i) => (
              <Item key={s.step} className="border-b border-border md:odd:border-r lg:border-r lg:last:border-r-0">
                <Spotlight className={`h-full py-10 ${pad} lg:px-8`}>
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1} · step</span>
                  <h3 className="mt-5 text-balance text-[24px] font-light leading-tight tracking-[-0.02em]">{s.step}</h3>
                  <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted-foreground">{s.detail}</p>
                </Spotlight>
              </Item>
            ))}
          </Stagger>
        </section>
    </motion.div>
  )
}
