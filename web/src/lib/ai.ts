import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, type GenerativeModel } from 'firebase/ai'
import { firebaseApp } from './firebase'
import { demoExplain, demoIssue, slug } from './demo'

// single cloud model. https://firebase.google.com/docs/ai-logic/models
export const MODEL = 'gemini-3.8-flash'

export type Prereq = { name: string; why: string }
export type Explain = { term: string; short: string; explanation: string; prerequisites: Prereq[]; example: string }
export type Issue = { title: string; summary: string; files: { path: string; why: string }[]; prerequisites: Prereq[]; path: { step: string; detail: string }[] }
export type Source = 'on_device' | 'in_cloud' | 'demo'
export type Deep = { text: string; sources: { title: string; uri: string }[] }

const str = { type: 'string' }
const schema = {
  type: 'object',
  properties: {
    term: str,
    short: str,
    explanation: str,
    example: str,
    prerequisites: { type: 'array', items: { type: 'object', properties: { name: str, why: str }, required: ['name', 'why'] } },
  },
  required: ['term', 'short', 'explanation', 'prerequisites', 'example'],
}

let m: { explain: GenerativeModel; deep: GenerativeModel } | null = null
function models() {
  const app = firebaseApp()
  if (!app) return null
  if (m) return m
  const ai = getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true })
  m = {
    // nano first, cloud fallback. same schema both sides
    explain: getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      onDeviceParams: { promptOptions: { responseConstraint: schema } },
      inCloudParams: { model: MODEL, generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema } },
    }),
    // cloud only: tools don't run on device
    deep: getGenerativeModel(ai, { model: MODEL, tools: [{ googleSearch: {} }, { urlContext: {} }] }),
  }
  return m
}

const stub = (term: string): Explain => ({
  term,
  short: `Demo mode has no entry for “${term}”.`,
  explanation: 'Set the Firebase env vars to explain any term with Gemini Nano on your device, falling back to Gemini in the cloud.',
  prerequisites: [],
  example: '',
})

// tool calls can't force a schema → pull first {...}
const json = <T,>(s: string): T => JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)) as T

/** Explain a term + its prerequisites. Nano when available. */
export async function explain(term: string, context = ''): Promise<{ data: Explain; source: Source }> {
  const md = models()
  if (!md) return { data: demoExplain[slug(term)] ?? stub(term), source: 'demo' }
  const r = await md.explain.generateContent(
    `Explain the technical term "${term}" to a developer in plain words.${context ? ` Context: ${context}.` : ''} ` +
      `short: one sentence. explanation: 2-3 sentences. example: a tiny code or real-world example. ` +
      `prerequisites: 2-5 concepts someone must understand first, each with a one-line why. Use short canonical concept names.`,
  )
  return { data: json<Explain>(r.response.text()), source: r.response.inferenceSource ?? 'in_cloud' }
}

/** Cloud deep dive with Google Search grounding. */
export async function deepDive(term: string): Promise<Deep> {
  const md = models()
  if (!md) return { text: `${demoExplain[slug(term)]?.explanation ?? stub(term).explanation}\n\nConnect Firebase for a grounded deep dive with sources.`, sources: [] }
  const r = await md.deep.generateContent(
    `Give a deep but readable explanation of "${term}" for a developer: how it works under the hood, common pitfalls, and when to use it. Plain text, short paragraphs, no markdown headings.`,
  )
  const chunks = r.response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
  return { text: r.response.text(), sources: chunks.flatMap((c) => (c.web?.uri ? [{ title: c.web.title ?? c.web.uri, uri: c.web.uri }] : [])) }
}

/** GitHub issue breakdown via URL context + search. Only the URL + known concept names leave the device. */
export async function breakdown(url: string, known: string[]): Promise<Issue> {
  const md = models()
  if (!md) return demoIssue
  const r = await md.deep.generateContent(
    `Read this GitHub issue and its repository: ${url}\n` +
      `The reader already knows: ${known.join(', ') || 'nothing yet'}.\n` +
      `Reply with ONLY a JSON object: {"title": string, "summary": string (plain words, 2-3 sentences), ` +
      `"files": [{"path": string, "why": string}] (3-6 files to read first), ` +
      `"prerequisites": [{"name": string, "why": string}] (concepts needed, short canonical names), ` +
      `"path": [{"step": string, "detail": string}] (3-6 step learning path that skips what the reader knows)}`,
  )
  return json<Issue>(r.response.text())
}
