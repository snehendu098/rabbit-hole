import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-rabbit-hole',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
});
const a = env.authenticatedContext('alice').firestore();
const b = env.authenticatedContext('bob').firestore();
const anon = env.unauthenticatedContext().firestore();
const now = serverTimestamp();
const ts = Timestamp.now();

const user = { createdAt: now, syncEnabled: true, reviewHour: 9, fcmTokens: ['t1'] };
const concept = { name: 'Rust', summary: 's', status: 'new', mastery: 0.5, seenCount: 1, firstSeen: ts, lastSeen: ts, updatedAt: now };
const issue = { url: 'https://github.com/o/r/issues/1', title: 't', summary: 's', files: [], prereqs: [], createdAt: now };

const tests = {
  'user create ok': () => assertSucceeds(setDoc(doc(a, 'users/alice'), user)),
  'user read other denied': () => assertFails(getDoc(doc(b, 'users/alice'))),
  'user anon denied': () => assertFails(getDoc(doc(anon, 'users/alice'))),
  'user extra field denied': () => assertFails(updateDoc(doc(a, 'users/alice'), { isAdmin: true })),
  'user createdAt immutable': () => assertFails(updateDoc(doc(a, 'users/alice'), { createdAt: ts })),
  'user bad reviewHour': () => assertFails(updateDoc(doc(a, 'users/alice'), { reviewHour: 24 })),
  'user bad token type': () => assertFails(updateDoc(doc(a, 'users/alice'), { fcmTokens: [1] })),
  'user too many tokens': () => assertFails(updateDoc(doc(a, 'users/alice'), { fcmTokens: Array(11).fill('x') })),
  'user update ok': () => assertSucceeds(updateDoc(doc(a, 'users/alice'), { displayName: 'Al', syncEnabled: false })),
  'concept ok': () => assertSucceeds(setDoc(doc(a, 'users/alice/concepts/rust-lang'), concept)),
  'concept bad slug': () => assertFails(setDoc(doc(a, 'users/alice/concepts/Rust_Lang'), concept)),
  'concept other user': () => assertFails(setDoc(doc(b, 'users/alice/concepts/x'), concept)),
  'concept mastery >1': () => assertFails(setDoc(doc(a, 'users/alice/concepts/x'), { ...concept, mastery: 2 })),
  'concept bad status': () => assertFails(setDoc(doc(a, 'users/alice/concepts/x'), { ...concept, status: 'gone' })),
  'concept client updatedAt': () => assertFails(setDoc(doc(a, 'users/alice/concepts/x'), { ...concept, updatedAt: ts })),
  'concept firstSeen immutable': () => assertFails(updateDoc(doc(a, 'users/alice/concepts/rust-lang'), { firstSeen: Timestamp.fromMillis(0), updatedAt: now })),
  'concept update ok': () => assertSucceeds(updateDoc(doc(a, 'users/alice/concepts/rust-lang'), { seenCount: 2, updatedAt: now })),
  'edge ok': () => assertSucceeds(setDoc(doc(a, 'users/alice/edges/a__b'), { from: 'a', to: 'b', updatedAt: now })),
  'edge id mismatch': () => assertFails(setDoc(doc(a, 'users/alice/edges/a__c'), { from: 'a', to: 'b', updatedAt: now })),
  'issue ok': () => assertSucceeds(setDoc(doc(a, 'users/alice/issues/i1'), issue)),
  'issue non-github': () => assertFails(setDoc(doc(a, 'users/alice/issues/i2'), { ...issue, url: 'https://evil.com/x' })),
  'issue no update': () => assertFails(updateDoc(doc(a, 'users/alice/issues/i1'), { title: 'x' })),
  'issue delete ok': () => assertSucceeds(deleteDoc(doc(a, 'users/alice/issues/i1'))),
  'review client create denied': () => assertFails(setDoc(doc(a, 'users/alice/reviews/r2'), { grade: 3 })),
  'review read ok': () => assertSucceeds(getDoc(doc(a, 'users/alice/reviews/r1'))),
  'review grade ok': () => assertSucceeds(updateDoc(doc(a, 'users/alice/reviews/r1'), { grade: 4, reviewedAt: now })),
  'review grade 6': () => assertFails(updateDoc(doc(a, 'users/alice/reviews/r1'), { grade: 6, reviewedAt: now })),
  'review other field': () => assertFails(updateDoc(doc(a, 'users/alice/reviews/r1'), { grade: 3, reviewedAt: now, concept: 'x' })),
  'review delete denied': () => assertFails(deleteDoc(doc(a, 'users/alice/reviews/r1'))),
  'unknown path denied': () => assertFails(setDoc(doc(a, 'users/alice/other/x'), { a: 1 })),
};

await env.withSecurityRulesDisabled((ctx) =>
  setDoc(doc(ctx.firestore(), 'users/alice/reviews/r1'), { concept: 'rust-lang', dueAt: ts }));

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { await fn(); console.log('ok  ', name); }
  catch (e) { failed++; console.log('FAIL', name, e.message); }
}
await env.cleanup();
console.log(`${Object.keys(tests).length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
