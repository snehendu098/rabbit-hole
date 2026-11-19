'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Fragment, useEffect, useState } from 'react'
import { Badge, Label } from '@/components/ds'
import { Dot } from '@/components/map'
import { demoConcepts, demoExplain, slug } from '@/lib/demo'

// article with hoverable terms; [x] = term
const article =
  'Under the hood, React hooks lean on [Closures] to remember values between renders. An effect hands a callback to the [Event loop], and most data fetching settles through [Promises]. Get those three and the rest of the docs stop feeling like magic.'
const parts = article.split(/\[([^\]]+)\]/)
const terms = parts.filter((_, i) => i % 2)
const status = Object.fromEntries(demoConcepts.map((c) => [c.slug, c.status]))
const ms = [212, 348, 287]

/** Hero: a doc paragraph, a term lights up, nano explains it with a prereq tree. */
export function HoverDemo() {
  const reduce = useReducedMotion()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setN((k) => k + 1), 4200)
    return () => clearInterval(id)
  }, [reduce])
  const term = terms[n % terms.length]!
  const e = demoExplain[slug(term)]!

  return (
    <div className="relative flex h-full min-h-[520px] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 pt-6 md:px-8 md:pt-8">
        <Label>react.dev / learn</Label>
        <Badge tone="live">on_device · nano</Badge>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-8 px-6 py-10 md:px-12">
        <p className="max-w-[46ch] text-pretty text-lg leading-[1.7] text-muted-foreground md:text-xl">
          {parts.map((p, i) =>
            i % 2 ? (
              <span key={i} className="relative whitespace-nowrap">
                <span className={`transition-colors duration-500 ${p === term ? 'text-foreground' : ''}`}>{p}</span>
                {p === term && (
                  <motion.span layoutId="hl" className="absolute -bottom-0.5 left-0 h-px w-full bg-live" transition={{ type: 'spring', stiffness: 260, damping: 30 }} />
                )}
              </span>
            ) : (
              <Fragment key={i}>{p}</Fragment>
            ),
          )}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={term}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[440px] border border-border bg-card/90 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <span className="text-base tracking-tight">{e.term}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">{ms[n % ms.length]}ms</span>
            </div>
            <p className="px-4 py-3 text-[15px] leading-relaxed">{e.short}</p>
            <div className="border-t border-border px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Prerequisites</span>
              <ul className="mt-2 flex flex-col gap-1.5">
                {e.prerequisites.map((p, i) => (
                  <motion.li
                    key={p.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.08, duration: 0.4 }}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <span aria-hidden className="font-mono text-muted-foreground">└</span>
                    <Dot status={status[slug(p.name)] ?? 'new'} />
                    <span>{p.name}</span>
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{status[slug(p.name)] ?? 'new'}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex h-12 items-center justify-between gap-4 border-t border-border px-6 font-mono text-[11px] uppercase tracking-wider text-muted-foreground md:px-8">
        <span className="tabular-nums">Concepts in graph {(1284 + n).toLocaleString('en-US')}</span>
        <span>History stays local</span>
      </div>
    </div>
  )
}
