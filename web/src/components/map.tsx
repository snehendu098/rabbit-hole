'use client'

import '@xyflow/react/dist/base.css'
import dagre from '@dagrejs/dagre'
import { Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, useNodesState, useReactFlow, type Edge as FEdge, type Node, type NodeProps } from '@xyflow/react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { Badge, Btn, Nav } from '@/components/ds'
import { hasFirebase } from '@/lib/firebase'
import { signInGoogle, useUser, type Edge, type Status } from '@/lib/graph'
import { cn } from '@/lib/utils'

const mono = 'font-mono text-[10px] uppercase tracking-wider text-muted-foreground'

/** Status square: known = solid, seen = dim, new = pulsing blue. */
export function Dot({ status, className }: { status: Status; className?: string }) {
  return <span aria-hidden className={cn('size-1.5 shrink-0', status === 'known' ? 'bg-foreground' : status === 'seen' ? 'bg-muted-foreground' : 'pc-pulse bg-live', className)} />
}

export function Legend({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-5', mono, className)}>
      {(['known', 'seen', 'new'] as const).map((s) => (
        <span key={s} className="inline-flex items-center gap-2"><Dot status={s} />{s}</span>
      ))}
    </div>
  )
}

/** Segmented known / seen / new control. */
export function StatusPick({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <div role="radiogroup" className="grid grid-cols-3 border border-border">
      {(['known', 'seen', 'new'] as const).map((s) => (
        <button
          key={s}
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={cn('relative flex h-9 items-center justify-center gap-2 border-r border-border font-mono text-[11px] uppercase tracking-wider transition-colors last:border-r-0', value === s ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
        >
          {value === s && <motion.span layoutId="pick" className="absolute inset-0 -z-0 bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
          <span className="relative z-10 inline-flex items-center gap-2"><Dot status={s} className={value === s && s === 'known' ? 'bg-primary-foreground' : ''} />{s}</span>
        </button>
      ))}
    </div>
  )
}

export type MapItem = { id: string; name: string; status: Status; center?: boolean; busy?: boolean }
type CNode = Node<MapItem, 'concept'>
const W = 184
const H = 62

function ConceptNode({ data, selected }: NodeProps<CNode>) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, filter: 'blur(6px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{ width: W, height: H }}
      className={cn(
        'group relative flex cursor-pointer flex-col justify-center gap-1.5 border bg-card px-3 transition-colors',
        selected ? 'border-foreground' : data.center ? 'border-foreground/50' : 'border-border hover:border-foreground/40',
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-1 !min-h-0 !min-w-0 !rounded-none !border-0 !bg-muted-foreground" />
      <span className={cn(mono, 'flex items-center gap-2')}>
        <Dot status={data.status} />
        {data.center ? 'concept' : data.status}
        {data.busy && <span className="pc-blink ml-auto text-live">thinking</span>}
      </span>
      <span className="truncate text-sm tracking-tight">{data.name}</span>
      <Handle type="source" position={Position.Bottom} className="!size-1 !min-h-0 !min-w-0 !rounded-none !border-0 !bg-muted-foreground" />
    </motion.div>
  )
}
const nodeTypes = { concept: ConceptNode }

// concept above its prereqs: down the hole
function layout(items: MapItem[], links: Edge[]): CNode[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 32, ranksep: 84 })
  g.setDefaultEdgeLabel(() => ({}))
  const ids = new Set(items.map((i) => i.id))
  for (const i of items) g.setNode(i.id, { width: W, height: H })
  for (const l of links) if (ids.has(l.from) && ids.has(l.to)) g.setEdge(l.to, l.from)
  dagre.layout(g)
  return items.map((i) => {
    const p = g.node(i.id)
    return { id: i.id, type: 'concept', position: { x: p.x - W / 2, y: p.y - H / 2 }, data: i }
  })
}

// refit when node set changes
function Fit({ sig }: { sig: string }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.3, duration: 700, maxZoom: 1.1 }), 80)
    return () => clearTimeout(t)
  }, [sig, fitView])
  return null
}

/** React Flow canvas in ds style; dagre layered layout. */
export function Canvas({ items, links, onSelect }: { items: MapItem[]; links: Edge[]; onSelect: (id: string | null) => void }) {
  const laid = layout(items, links)
  const sig = JSON.stringify([items, links])
  const [nodes, setNodes, onNodesChange] = useNodesState(laid)
  const [prev, setPrev] = useState(sig)
  // derived reset: relayout when data changes
  if (sig !== prev) {
    setPrev(sig)
    setNodes(laid)
  }
  const status = Object.fromEntries(items.map((i) => [i.id, i.status]))
  const edges: FEdge[] = links
    .filter((l) => status[l.from] && status[l.to])
    .map((l) => ({
      id: `${l.from}__${l.to}`,
      source: l.to,
      target: l.from,
      animated: status[l.from] === 'new',
      style: { stroke: status[l.from] === 'new' ? 'var(--live)' : 'var(--muted-foreground)', strokeOpacity: status[l.from] === 'new' ? 0.55 : 0.35, strokeWidth: 1 },
    }))

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, n) => onSelect(n.id)}
      onPaneClick={() => onSelect(null)}
      nodesConnectable={false}
      minZoom={0.2}
      fitView
      proOptions={{ hideAttribution: true }}
      className="rh-flow"
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="rgb(232 228 220 / 0.08)" />
      <Controls showInteractive={false} position="bottom-right" />
      <Fit sig={items.map((i) => i.id).join()} />
    </ReactFlow>
  )
}

/** Right side sheet over the canvas. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: '100%', opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.6 }}
          transition={{ type: 'spring', stiffness: 260, damping: 32 }}
          className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[440px] flex-col overflow-y-auto border-l border-border bg-background/95 backdrop-blur-md"
        >
          <button onClick={onClose} className={cn(mono, 'absolute right-4 top-4 z-10 border border-border px-2 py-1 transition-colors hover:border-foreground hover:text-foreground')}>
            Close ×
          </button>
          {children}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

const tabs = [
  ['/explore', '/explore?concept=closures', 'Explore'],
  ['/graph', '/graph', 'Graph'],
  ['/issue', '/issue', 'Issue'],
] as const

/** App nav: page tabs left, account right. */
export function AppNav() {
  const path = usePathname()
  const user = useUser()
  return (
    <Nav
      left={
        <nav className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-wider">
          {tabs.map(([p, href, label]) => (
            <Link key={p} href={href} className={cn('relative py-1 transition-colors', path.startsWith(p) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {label}
              {path.startsWith(p) && <motion.span layoutId="tab" className="absolute -bottom-px left-0 h-px w-full bg-foreground" />}
            </Link>
          ))}
        </nav>
      }
      right={
        !hasFirebase ? (
          <Badge tone="muted">demo data</Badge>
        ) : user && !user.isAnonymous ? (
          <span className={cn(mono, 'truncate')}>{user.displayName ?? user.email}</span>
        ) : (
          <Btn size="sm" variant="outline" onClick={() => signInGoogle()}>Sign in with Google</Btn>
        )
      }
    />
  )
}

/** Full-height area under the nav. */
export const stage = 'relative h-[calc(100svh-57px)] min-h-[560px] overflow-hidden'
