// offscreen doc: dom ctx w/ window + LanguageModel. all ai lives here
import { initializeApp } from 'firebase/app'
import { CustomProvider, initializeAppCheck } from 'firebase/app-check'
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, type GenerativeModel } from 'firebase/ai'
import { CONCEPTS_SCHEMA, EXPLAIN_SCHEMA, LM_OPTS, type Explanation, type OffMsg, type Source } from './lib'

const MODEL = 'gemini-3.5-flash-lite'
const env = import.meta.env

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

// ext has no web origin -> no recaptcha. debug token only
if (env.VITE_APPCHECK_DEBUG_TOKEN) {
  ;(self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN
  initializeAppCheck(app, {
    provider: new CustomProvider({ getToken: () => Promise.reject(new Error('debug only')) }),
    isTokenAutoRefreshEnabled: true,
  })
}

const ai = getAI(app, { backend: new GoogleAIBackend() })
const inCloudParams = {
  model: MODEL,
  generationConfig: { responseMimeType: 'application/json', responseJsonSchema: EXPLAIN_SCHEMA },
}
// lazy: ctor throws if config missing, must not kill extract path
const hybrid = () =>
  getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    onDeviceParams: { createOptions: LM_OPTS as never, promptOptions: { responseConstraint: EXPLAIN_SCHEMA } },
    inCloudParams,
  })
const cloud = () => getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams })

const explainPrompt = (term: string) =>
  `Explain the technical term "${term}" for a developer. Return JSON: term (canonical name), short (one sentence, <25 words), explanation (2-4 sentences), prerequisites (up to 5 concepts needed first, each {name, why}). Prerequisite names: short canonical concept names.`

async function viaFirebase(m: () => GenerativeModel, term: string) {
  const r = await m().generateContent(explainPrompt(term))
  const src: Source = r.response.inferenceSource === 'on_device' ? 'ON_DEVICE' : 'IN_CLOUD'
  return { ...(JSON.parse(r.response.text()) as Explanation), inferenceSource: src }
}

// raw prompt api, on-device only. null if not ready
async function viaPromptApi(prompt: string, schema: object): Promise<unknown | null> {
  if ((await globalThis.LanguageModel?.availability(LM_OPTS)) !== 'available') return null
  const s = await LanguageModel!.create(LM_OPTS)
  try {
    return JSON.parse(await s.prompt(prompt, { responseConstraint: schema }))
  } finally {
    s.destroy()
  }
}

async function explain(term: string) {
  try {
    return await viaFirebase(hybrid, term)
  } catch (e) {
    console.warn('[rh] hybrid failed', e)
  }
  try {
    const r = await viaPromptApi(explainPrompt(term), EXPLAIN_SCHEMA)
    if (r) return { ...(r as Explanation), inferenceSource: 'PROMPT_API' as const }
  } catch (e) {
    console.warn('[rh] prompt api failed', e)
  }
  return viaFirebase(cloud, term)
}

// page text: on-device only, never cloud
async function extract(text: string) {
  const r = (await viaPromptApi(
    `List up to 10 key technical concepts (short canonical names) in this text. Return JSON {concepts: string[]}.\n\n${text.slice(0, 6000)}`,
    CONCEPTS_SCHEMA,
  )) as { concepts: string[] } | null
  return r?.concepts.slice(0, 10) ?? null
}

chrome.runtime.onMessage.addListener((m: OffMsg, _s, reply) => {
  if (m.target !== 'offscreen') return
  const p = m.type === 'explain' ? explain(m.term) : extract(m.text)
  p.then(
    (data) => reply({ data }),
    (e) => reply({ error: String(e?.message ?? e) }),
  )
  return true
})
