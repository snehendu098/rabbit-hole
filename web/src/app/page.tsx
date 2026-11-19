import Link from 'next/link'
import type { ReactNode } from 'react'
import { Btn, Frame, Index, Item, Label, Mark, Nav, Reveal, Rule, Spotlight, Stagger } from '@/components/ds'
import { HoverDemo } from '@/components/landing'
import PixelBlast from '@/components/PixelBlast'
import PixelSnow from '@/components/PixelSnow'
import Radar from '@/components/Radar'
import Topography from '@/components/Topography'

// rhythm: every section block py-20/32; label → 24 → heading → 24 → sub → 40 → CTA / list
const pad = 'px-6 md:px-12 lg:px-16'
const sy = 'py-20 md:py-32'
const h2 = 'text-balance text-[clamp(40px,4vw,64px)] font-light leading-[1] tracking-[-0.04em]'
const sub = 'mt-6 max-w-[52ch] text-pretty text-base leading-relaxed text-muted-foreground md:text-lg'

function SectionHead({ n, mark, label }: { n: number; mark: string; label: string }) {
  return (
    <div className={`flex h-14 items-center justify-between gap-4 border-b border-border ${pad}`}>
      <div className="flex items-center gap-6">
        <Index n={n} />
        <Mark>{mark}</Mark>
      </div>
      <Label className="hidden sm:inline">{label}</Label>
    </div>
  )
}

// feature strip under a split: 1 / 2 / 4 columns, hairline cells
function Points({ items }: { items: [string, string][] }) {
  return (
    <Stagger inView gap={0.06} className="grid border-t border-border sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([k, v]) => (
        <Item key={k} className="border-b border-border sm:odd:border-r lg:border-b-0 lg:border-r lg:last:border-r-0">
          <div className={`group h-full py-8 transition-colors hover:bg-foreground/[0.02] md:py-12 ${pad}`}>
            <span
              aria-hidden
              className="inline-block font-mono text-sm text-muted-foreground transition-transform duration-300 group-hover:rotate-90 group-hover:text-foreground"
            >
              +
            </span>
            <h3 className="mt-6 text-lg tracking-tight">{k}</h3>
            <p className="mt-2 max-w-[36ch] text-pretty text-[15px] leading-relaxed text-muted-foreground">{v}</p>
          </div>
        </Item>
      ))}
    </Stagger>
  )
}

function Split({ text, visual, points, flip }: { text: ReactNode; visual: ReactNode; points: [string, string][]; flip?: boolean }) {
  return (
    <>
      {/* text 5fr / visual 7fr, shared vertical padding, centred to each other */}
      <div className={`grid ${flip ? 'lg:grid-cols-[7fr_5fr]' : 'lg:grid-cols-[5fr_7fr]'}`}>
        <div className={`flex flex-col justify-center ${pad} pb-12 pt-20 md:pb-16 md:pt-32 lg:py-32 ${flip ? 'lg:order-2' : ''}`}>{text}</div>
        {/* visual fills cell edge to edge, no inner frame */}
        <div
          className={`relative aspect-[16/10] overflow-hidden border-t border-border lg:aspect-auto lg:border-t-0 ${flip ? 'lg:order-1 lg:border-r' : 'lg:border-l'}`}
        >
          {visual}
        </div>
      </div>
      <Points items={points} />
    </>
  )
}

const steps: { n: 1 | 2 | 3; k: string; t: string; d: string }[] = [
  {
    n: 1,
    k: 'read',
    t: 'Nano reads on your device',
    d: 'Select or hover a term. Gemini Nano explains it in Chrome in under a second. The page and your history never leave the browser.',
  },
  {
    n: 2,
    k: 'map',
    t: 'Concepts land in your graph',
    d: 'Every term and its prerequisites become nodes, marked known, seen or new. Only concept names sync, and only if you opt in.',
  },
  {
    n: 3,
    k: 'dive',
    t: 'Gemini goes deep in the cloud',
    d: 'Ask for a deep dive or paste a GitHub issue. Gemini in the cloud reads the URL, searches the web and builds your learning path.',
  },
]

export default function Home() {
  return (
    <Frame nav={<Nav />}>
      {/* hero */}
      <section className="grid lg:grid-cols-2">
        <Stagger delay={0.1} className={`flex flex-col justify-center gap-12 md:gap-16 ${pad} ${sy}`}>
          <Item>
            <Label>Built for people who read docs at 2am</Label>
          </Item>
          <div>
            <Item>
              <h1 className="text-[clamp(46px,5.3vw,100px)] font-light leading-[0.94] tracking-[-0.05em]">
                Every word you don&apos;t know <br />
                is a rabbit hole. <br />
                <span className="text-muted-foreground">We map it.</span>
              </h1>
            </Item>
            <Item>
              <p className={`${sub} mt-8`}>
                Hover any term. Get the explanation, the prerequisites, and what you already know. On your device.
              </p>
            </Item>
            <Item className="mt-10 flex flex-wrap gap-3">
              <Btn href="#install">Add to Chrome</Btn>
              <Btn href="/explore?concept=closures" variant="outline">
                Open the map
              </Btn>
            </Item>
          </div>
          <Item className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Gemini Nano on-device</span>
            <span>Firebase AI Logic</span>
            <span>Knowledge graph</span>
            <span>Chrome · Android · iOS</span>
          </Item>
        </Stagger>
        <Spotlight className="border-t border-border bg-card lg:border-l lg:border-t-0">
          <HoverDemo />
        </Spotlight>
      </section>

      <Rule />

      {/* {01} hover explain */}
      <section id="explain">
        <SectionHead n={1} mark="Hover explain" label="Gemini Nano · on-device" />
        <Split
          text={
            <Reveal>
              <Label>Any blog, any doc</Label>
              <h2 className={`${h2} mt-6`}>Point at a word. Understand it before you scroll on.</h2>
              <p className={sub}>
                Select or hover a term on any page. Rabbit Hole explains it in plain words and shows what you need to learn first, checked against what you
                already know.
              </p>
            </Reveal>
          }
          visual={
            <Radar color="#9e9e9e" mode="sweep" speed={1} trail={0.35} scale={0.9} ringCount={6} spokeCount={12} targets={6} clutter={0.35} mouseInteraction />
          }
          points={[
            ['Instant', 'Gemini Nano runs in Chrome. Answers land in under a second, even offline.'],
            ['Private', 'Your reading history stays on your device. Always.'],
            ['Prerequisites', 'Each answer comes with the concepts underneath it.'],
            ['Knows what you know', 'Prerequisites are marked known, seen or new against your graph.'],
          ]}
        />
      </section>

      <Rule />

      {/* {02} knowledge graph */}
      <section id="graph">
        <SectionHead n={2} mark="Your knowledge graph" label="Firestore · opt-in sync" />
        <Split
          flip
          text={
            <Reveal>
              <Label>It grows while you read</Label>
              <h2 className={`${h2} mt-6`}>A map of everything you know. Built by reading.</h2>
              <p className={sub}>
                Every term you look up becomes a node with its prerequisites wired in. Mark what you know, see what you keep running into, and find the gap
                behind the confusion.
              </p>
              <div className="mt-10">
                <Btn href="/graph" variant="outline">See a graph</Btn>
              </div>
            </Reveal>
          }
          visual={
            <PixelBlast
              variant="square"
              pixelSize={3}
              color="#878787"
              patternScale={2}
              patternDensity={1}
              softness={0.6}
              glow={0.4}
              twinkle={0.25}
              drift={0.2}
              hoverEffect="reveal"
              enableRipples
              edgeFade={0.25}
              accentColor="#383838"
            />
          }
          points={[
            ['Builds itself', 'No notes to take. Concepts and links appear as you read.'],
            ['Synced', 'Opt in to sync concept names across devices with Firestore.'],
            ['Review on phone', 'Your new and seen concepts become review cards on Android and iOS.'],
            ['Ask your graph', 'Paste a GitHub issue and get a path that skips what you know.'],
          ]}
        />
      </section>

      <Rule />

      {/* {03} issue mode / how it works */}
      <section id="issue">
        <SectionHead n={3} mark="GitHub issue mode" label="Hybrid · device + cloud" />
        <div className={`${pad} ${sy}`}>
          <Reveal className="grid items-end gap-6 lg:grid-cols-2">
            <div>
              <Label>From a word to a pull request</Label>
              <h2 className={`${h2} mt-6 max-w-[18ch]`}>Three hops between a strange word and your first fix.</h2>
            </div>
            <div className="lg:justify-self-end">
              <p className={sub}>
                Open any GitHub issue. Get a plain-words breakdown, the files to read, the prerequisites marked against your graph and a learning path made
                for you.
              </p>
              <div className="mt-10">
                <Btn href="/issue" variant="outline">Try issue mode</Btn>
              </div>
            </div>
          </Reveal>
        </div>
        <div className="relative h-[280px] border-t border-border md:h-[420px]">
          <Topography
            color="#5f5f5f"
            lineCount={18}
            lineWidth={1.2}
            elevation={1.6}
            foreground={0.2}
            tilt={24}
            speed={0.25}
            direction="forward"
            glow={0.6}
            depthOfField={0.4}
            fog={0.5}
            hoverEffect="lift"
            clickEffect="peak"
            scale={0.9}
          />
        </div>
        <Stagger inView gap={0.12} className="grid border-t border-border md:grid-cols-3">
          {steps.map((s) => (
            <Item key={s.n} className="border-b border-border last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <Spotlight className={`h-full ${pad} py-12 md:px-10 md:py-16`}>
                <span className="font-mono text-xs text-muted-foreground">
                  0{s.n} · <span className="uppercase tracking-wider">{s.k}</span>
                </span>
                <h3 className="mt-6 text-balance text-[28px] font-light leading-tight tracking-[-0.02em]">{s.t}</h3>
                <p className="mt-4 max-w-[40ch] text-pretty text-[15px] leading-relaxed text-muted-foreground">{s.d}</p>
              </Spotlight>
            </Item>
          ))}
        </Stagger>
      </section>

      <Rule />

      {/* closing CTA: snow fills section edge to edge */}
      <section id="install" className="relative overflow-hidden">
        <div className="absolute inset-0">
          <PixelSnow color="#ffffff" variant="snowflake" density={0.5} speed={1} wind={0.25} flakeSize={1} pixelSize={3} glow={0.8} mouseInteraction />
        </div>
        <Reveal className={`relative text-center ${pad} py-28 md:py-44`}>
          <Label>Free · open source · Apache-2.0</Label>
          <h2 className="mx-auto mt-8 max-w-[14ch] text-balance text-[clamp(48px,7vw,120px)] font-light leading-[0.92] tracking-[-0.05em]">
            Fall down the right rabbit hole
          </h2>
          <p className="mx-auto mt-8 max-w-[46ch] text-pretty text-muted-foreground md:text-lg">
            Install the extension, open any doc and hover the first word you don&apos;t know.
          </p>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Btn href="https://github.com/snehendu098/rabbit-hole">Add to Chrome</Btn>
            <Btn href="/explore?concept=closures" variant="outline">
              Open the map
            </Btn>
          </div>
        </Reveal>
      </section>

      <Rule />

      <footer
        className={`flex flex-col gap-6 py-10 font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:flex-row sm:items-center sm:justify-between ${pad}`}
      >
        <span>Built on Firebase AI Logic · Gemini Nano</span>
        <nav className="flex gap-8">
          <Link href="/explore?concept=closures" className="transition-colors hover:text-foreground">
            Explore
          </Link>
          <Link href="/graph" className="transition-colors hover:text-foreground">
            Graph
          </Link>
          <a href="https://github.com/snehendu098/rabbit-hole" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
            GitHub
          </a>
        </nav>
      </footer>
    </Frame>
  )
}
