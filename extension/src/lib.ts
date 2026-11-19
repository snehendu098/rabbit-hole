// shared types + pure helpers. no imports: content script bundles this too

export type Status = 'known' | 'seen' | 'new'
export type Source = 'ON_DEVICE' | 'IN_CLOUD' | 'PROMPT_API'
export type Prereq = { name: string; why: string }
export type Explanation = { term: string; short: string; explanation: string; prerequisites: Prereq[] }
export type Explained = Explanation & {
  inferenceSource: Source
  status: Status
  prerequisites: (Prereq & { status: Status })[]
}
export type Concept = {
  slug: string
  name: string
  summary: string
  status: Status
  seenCount: number
  firstSeen: number
  lastSeen: number
}
export type Edge = { from: string; to: string }

// content -> sw
export type Msg =
  | { type: 'explain'; term: string }
  | { type: 'markKnown'; name: string }
  | { type: 'extract'; text: string }
// sw -> offscreen
export type OffMsg = { target: 'offscreen' } & (
  | { type: 'explain'; term: string }
  | { type: 'extract'; text: string }
)

export const WEB_URL = (import.meta.env.VITE_WEB_URL as string | undefined) || 'http://localhost:3000'

// same opts everywhere: availability depends on them
export const LM_OPTS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
}

declare global {
  // chrome prompt api, minimal
  var LanguageModel:
    | {
        availability(o?: object): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>
        create(o?: object): Promise<{ prompt(input: string, o?: object): Promise<string>; destroy(): void }>
      }
    | undefined
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// 1-5 words, not a sentence blob
export const isTerm = (s: string) => {
  const t = s.trim()
  return t.length > 1 && t.length <= 60 && t.split(/\s+/).length <= 5 && /[a-z]/i.test(t)
}

const DEV_HOSTS =
  /(^|\.)(github\.com|gitlab\.com|stackoverflow\.com|stackexchange\.com|developer\.mozilla\.org|dev\.to|npmjs\.com|pypi\.org|readthedocs\.io|arxiv\.org|news\.ycombinator\.com|huggingface\.co|web\.dev|developer\.chrome\.com)$/
// ponytail: host list + code count heuristic, swap for classifier if noisy
export const isTechPage = (host: string, codeBlocks: number) =>
  DEV_HOSTS.test(host) || /^(docs|developer|developers)\./.test(host) || /\.dev$/.test(host) || codeBlocks >= 2

const RANK: Record<Status, number> = { new: 0, seen: 1, known: 2 }
// never downgrade
export const maxStatus = (a: Status, b: Status) => (RANK[a] >= RANK[b] ? a : b)

const prereqSchema = {
  type: 'object',
  properties: { name: { type: 'string' }, why: { type: 'string' } },
  required: ['name', 'why'],
}
// json schema: cloud responseJsonSchema + on-device responseConstraint
export const EXPLAIN_SCHEMA = {
  type: 'object',
  properties: {
    term: { type: 'string' },
    short: { type: 'string' },
    explanation: { type: 'string' },
    prerequisites: { type: 'array', items: prereqSchema, maxItems: 5 },
  },
  required: ['term', 'short', 'explanation', 'prerequisites'],
}
export const CONCEPTS_SCHEMA = {
  type: 'object',
  properties: { concepts: { type: 'array', items: { type: 'string' }, maxItems: 10 } },
  required: ['concepts'],
}
