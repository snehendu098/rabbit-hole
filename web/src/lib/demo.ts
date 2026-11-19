// ponytail: demo data, real fetch when env set
import type { Explain, Issue } from './ai'
import type { Concept, Edge, Status } from './graph'

type Seed = [name: string, status: Status, short: string, explanation: string, example: string, prereqs: [string, string][]]

const seed: Seed[] = [
  ['Closures', 'new', 'A function that remembers the variables around where it was made.',
    'When a function is created inside another function, it keeps a live link to the outer variables. Even after the outer function returns, the inner one can still read and change them.',
    'function counter() { let n = 0; return () => ++n }\nconst next = counter(); next(); next() // 2',
    [['Functions', 'A closure is a function, so you need to know how functions are defined and called.'], ['Lexical scope', 'Closures capture variables by where code is written, which is lexical scope.'], ['First-class functions', 'You return and pass closures around like values.']]],
  ['Lexical scope', 'new', 'Variables are visible based on where code is written, not where it runs.',
    'The nesting of your source code decides which variables a piece of code can see. Inner blocks see outer variables; outer code cannot see inner ones.',
    'const a = 1\nfunction f() { return a } // sees a',
    [['Scope', 'Lexical scope is one rule for deciding scope.'], ['Variables', 'Scope is about where variables are visible.']]],
  ['First-class functions', 'seen', 'Functions are values: store them, pass them, return them.',
    'A language has first-class functions when a function can go anywhere a number or string can: into a variable, an argument, an array, or a return value.',
    'const twice = (f) => (x) => f(f(x))\ntwice((n) => n + 1)(0) // 2',
    [['Functions', 'You need the basic idea of a function first.']]],
  ['Functions', 'known', 'A named, reusable block of code that takes inputs and returns an output.',
    'Functions package logic so you can call it many times with different arguments.',
    'function add(a, b) { return a + b }',
    [['Variables', 'Parameters and return values are held in variables.']]],
  ['Scope', 'known', 'The region of code where a variable can be used.',
    'Every variable lives in a scope: global, function, or block. Outside it, the name means nothing.',
    '{ let x = 1 } // x not visible here',
    [['Variables', 'Scope decides where variables are visible.']]],
  ['Variables', 'known', 'A name bound to a value.', 'Variables let you label a value and refer to it later.', 'let x = 42', []],
  ['Event loop', 'new', 'The scheduler that runs your async callbacks one at a time.',
    'JavaScript runs one thing at a time. The event loop waits for the call stack to empty, then pulls the next queued task or microtask and runs it.',
    "setTimeout(() => console.log('b'))\nconsole.log('a') // a, then b",
    [['Call stack', 'The loop only runs new work when the stack is empty.'], ['Callbacks', 'What the loop actually runs are queued callbacks.'], ['Promises', 'Promise reactions run in the microtask queue.']]],
  ['Promises', 'seen', 'An object for a value that arrives later.',
    'A promise is pending, then fulfilled or rejected. You attach handlers with then/await instead of nesting callbacks.',
    'const r = await fetch(url)',
    [['Callbacks', 'Promises are a cleaner wrapper around callbacks.']]],
  ['Callbacks', 'seen', 'A function you hand over to be called later.',
    'You pass a function to some other code, which calls it when something happens: a timer fires, a request finishes, a button is clicked.',
    "button.addEventListener('click', () => alert('hi'))",
    [['First-class functions', 'Passing a function as an argument needs first-class functions.']]],
  ['Call stack', 'seen', 'The list of function calls currently running.',
    'Each call pushes a frame; each return pops it. Errors show this stack as a trace.',
    'a() → b() → c()  // stack: a, b, c',
    [['Functions', 'The stack is made of function calls.']]],
]

export const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const demoExplain: Record<string, Explain> = Object.fromEntries(
  seed.map(([term, , short, explanation, example, p]) => [slug(term), { term, short, explanation, example, prerequisites: p.map(([name, why]) => ({ name, why })) }]),
)

const t = Date.now()
export const demoConcepts: Concept[] = seed.map(([name, status, short], i) => ({
  slug: slug(name), name, summary: short, status, mastery: status === 'known' ? 0.9 : status === 'seen' ? 0.4 : 0,
  seenCount: status === 'new' ? 0 : 3 + i, firstSeen: t - 864e5 * (20 - i), lastSeen: t - 36e5 * i,
}))
export const demoEdges: Edge[] = seed.flatMap(([name, , , , , p]) => p.map(([pre]) => ({ from: slug(pre), to: slug(name) })))

export const demoIssue: Issue = {
  title: 'Stale value inside setInterval callback',
  summary:
    'A counter rendered with a hook shows the right number, but the interval callback keeps logging the first value. The callback closed over the state from the first render and never sees updates.',
  files: [
    { path: 'src/hooks/useTicker.ts', why: 'Where the interval is created and the stale variable is captured.' },
    { path: 'src/components/Clock.tsx', why: 'The consumer that shows the symptom.' },
    { path: 'src/hooks/useTicker.test.ts', why: 'Add a failing test here before the fix.' },
  ],
  prerequisites: [
    { name: 'Closures', why: 'The bug is a closure holding an old value.' },
    { name: 'Event loop', why: 'Interval callbacks are queued and run later.' },
    { name: 'Callbacks', why: 'setInterval takes a callback.' },
    { name: 'Lexical scope', why: 'Decides which variable the callback captured.' },
  ],
  path: [
    { step: 'Learn closures', detail: 'Open the map for Closures and mark it known when the counter example makes sense.' },
    { step: 'Reproduce', detail: 'Run the Clock story and watch the console log stay at 0.' },
    { step: 'Read useTicker.ts', detail: 'Find the variable the interval callback reads.' },
    { step: 'Fix and test', detail: 'Read the latest value through a ref or a functional update, then make the test pass.' },
  ],
}
