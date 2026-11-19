import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// no env → demo mode, app still renders
export const hasFirebase = Boolean(config.apiKey && config.projectId && config.appId)

let app: FirebaseApp | null = null

/** Lazy browser-only app + App Check. null in demo mode / during prerender. */
export function firebaseApp(): FirebaseApp | null {
  if (!hasFirebase || typeof window === 'undefined') return null
  if (app) return app
  app = getApps()[0] ?? initializeApp(config)
  const key = process.env.NEXT_PUBLIC_RECAPTCHA_KEY
  if (key) {
    // debug: sdk prints a token to console, register it in console. never hardcode
    if (process.env.NEXT_PUBLIC_APPCHECK_DEBUG === '1') (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(key), isTokenAutoRefreshEnabled: true })
  }
  return app
}
