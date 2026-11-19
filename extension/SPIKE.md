# Spike: Firebase AI Logic hybrid in MV3

## Setup
- `firebase@13.4.0`. API: `getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE, onDeviceParams, inCloudParams })`.
- Enum values: `prefer_on_device | only_on_device | only_in_cloud | prefer_in_cloud`. `response.inferenceSource`: `on_device | in_cloud`.
- Cloud model: `gemini-3.5-flash-lite` (same as SDK hybrid default). Constant `MODEL` in `src/offscreen.ts`.
- Structured output: one JSON schema, sent 2 ways: cloud `generationConfig.responseJsonSchema`, on-device `onDeviceParams.promptOptions.responseConstraint`. SDK does not translate one into the other.
- SDK default `expectedInputs` includes `image`. We pass text-only (`LM_OPTS`) so availability isn't blocked by multimodal support.

## Where AI runs
- SW: no `LanguageModel` (workers unsupported). SDK picks adapter via `window.LanguageModel`, so no hybrid there.
- Offscreen doc (reason `DOM_PARSER`, no AI reason exists): `LanguageModel` **is defined** (verified headless, Chrome for Testing 158). Firebase loads, hybrid model builds.
- Flow: content -> `chrome.runtime` -> SW (graph, counters) -> offscreen (AI) -> back.
- Fallback chain: hybrid -> raw Prompt API (`availability()==='available'`) -> Firebase `ONLY_IN_CLOUD`. Badge shows `ON_DEVICE | PROMPT_API | IN_CLOUD`.
- PREFER_ON_DEVICE silently goes cloud when model not `available` (never downloads). Download needs user activation -> popup "Enable on-device AI" calls `LanguageModel.create()` in click handler. Model is per-profile, offscreen reuses it. (Did not use `initializeDeviceModel` in offscreen: no gesture there.)
- Extraction (page text) uses raw Prompt API only. Unavailable -> skip. Page text never reaches cloud. Explain sends only the term.
- Missing Firebase config: model ctor throws `AI/no-api-key`; lazy so extraction still works. Tooltip shows error.

## App Check
No web origin -> no reCAPTCHA. If `VITE_APPCHECK_DEBUG_TOKEN` set: `self.FIREBASE_APPCHECK_DEBUG_TOKEN = token` + `CustomProvider` that rejects (debug path skips provider). Register token in Firebase console. Unset -> no App Check (fails if enforced). Token is baked into `dist/` — never ship that build.

## Verified headless
Builds, extension loads, SW starts, offscreen created, `LanguageModel` present in popup + offscreen (`availability()` = `unavailable`, no model), full message round trip, IndexedDB writes, tooltip renders (error + mocked success).

## Not verifiable headless
Real Gemini Nano inference, model download, hybrid returning `on_device`, cloud call (needs config), App Check exchange.

## Manual test (Chrome 139+)
1. `cp .env.example .env`, fill Firebase config (+ debug token), `bun run build`.
2. `chrome://flags/#optimization-guide-on-device-model` -> Enabled BypassPerfRequirement; `#prompt-api-for-gemini-nano` -> Enabled. Relaunch.
3. Load `extension/dist` unpacked. Popup -> "Enable on-device AI" -> wait until `available` (check `chrome://on-device-internals`).
4. Select a term on any page -> `?` -> badge should read ON-DEVICE. Turn flags off -> CLOUD.
5. Visit docs/GitHub page, wait ~5s, inspect offscreen (chrome://extensions -> inspect views) and SW IndexedDB `rabbit-hole`.
6. GitHub issue page -> "Dive with Rabbit Hole" next to title.
