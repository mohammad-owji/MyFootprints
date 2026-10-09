import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type DocumentReference,
} from "firebase/firestore";

import { getDb } from "./firebase";
import type { CountryId, VisitedRepository } from "./VisitedRepository";

/**
 * Firestore-backed {@link VisitedRepository}, scoped to one signed-in user.
 *
 * The visited ids live in a single document at `users/{uid}` as a string array.
 * Reads happen once in {@link init}; every mutation updates the in-memory cache
 * and mirrors the full array back to Firestore. Writes are fire-and-forget with
 * error logging, so a brief network blip never blocks the UI.
 */
export class FirestoreVisitedRepository implements VisitedRepository {
  private cache: Set<CountryId> = new Set();
  private readonly ref: DocumentReference;

  constructor(uid: string) {
    this.ref = doc(getDb(), "users", uid);
  }

  /**
   * Load the user's document. If it does not exist yet, create it seeded from
   * `seed` (the local data), so a first-time sign-in keeps existing progress.
   */
  async init(seed: Set<CountryId>): Promise<void> {
    const snap = await getDoc(this.ref);
    if (snap.exists()) {
      const data = snap.data() as { visited?: unknown };
      const ids = Array.isArray(data.visited) ? data.visited.map(String) : [];
      this.cache = new Set(ids);
    } else {
      this.cache = new Set(seed);
      await this.persist();
    }
  }

  async getVisited(): Promise<Set<CountryId>> {
    return new Set(this.cache);
  }

  async toggleVisited(id: CountryId): Promise<boolean> {
    let nowVisited: boolean;
    if (this.cache.has(id)) {
      this.cache.delete(id);
      nowVisited = false;
    } else {
      this.cache.add(id);
      nowVisited = true;
    }
    await this.persist();
    return nowVisited;
  }

  async setVisited(ids: CountryId[]): Promise<void> {
    this.cache = new Set(ids);
    await this.persist();
  }

  private async persist(): Promise<void> {
    try {
      await setDoc(
        this.ref,
        { visited: [...this.cache], updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (err) {
      // Offline or rules error — keep the in-memory state and surface it.
      console.error("Failed to save visited countries to Firestore:", err);
    }
  }
}
