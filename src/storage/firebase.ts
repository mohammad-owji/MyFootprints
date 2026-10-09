/**
 * Firebase bootstrap: app, auth and Firestore, all initialised lazily and only
 * when a configuration is present. Everything here is a no-op when the app is
 * not configured, so the rest of the code can call it unconditionally and fall
 * back to localStorage.
 *
 * The web config values are not secrets (they ship in every Firebase web app);
 * access is secured by Firebase Auth + Firestore security rules, not by hiding
 * these keys. They live in a .env file purely so each deployment uses its own
 * project. See .env.example and the README for setup.
 */
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { firebaseConfig as config } from "./firebaseConfig";

export type { User };

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (!app) app = initializeApp(config);
  return app;
}

export function getAuthInstance(): Auth {
  if (!authInstance) authInstance = getAuth(ensureApp());
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(ensureApp());
  return dbInstance;
}

/** Subscribe to sign-in/out; returns an unsubscribe function. */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(getAuthInstance(), cb);
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(getAuthInstance(), provider);
}

export async function signOutUser(): Promise<void> {
  await signOut(getAuthInstance());
}
