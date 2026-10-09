/**
 * Cloud-sync facade. This module statically imports the Firebase SDK, so it (and
 * Firebase) ends up in its own chunk that is only fetched when the app is
 * configured and dynamically imports it from src/app.ts.
 */
import {
  onAuthChange,
  signInWithGoogle,
  signOutUser,
  type User,
} from "./firebase";
import { FirestoreVisitedRepository } from "./FirestoreVisitedRepository";
import type { CountryId, VisitedRepository } from "./VisitedRepository";

export type { User };

export interface CloudSync {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export interface CloudSyncOptions {
  /** Current local data, used to seed a new user's cloud document. */
  getLocalSeed: () => Promise<Set<CountryId>>;
  /**
   * Called on every auth change with the repository to use now (the Firestore
   * store when signed in, or `null` to fall back to local) and the user.
   */
  onChange: (
    repo: VisitedRepository | null,
    user: User | null,
  ) => void | Promise<void>;
}

export function startCloudSync(opts: CloudSyncOptions): CloudSync {
  onAuthChange(async (user) => {
    if (user) {
      const fs = new FirestoreVisitedRepository(user.uid);
      await fs.init(await opts.getLocalSeed());
      await opts.onChange(fs, user);
    } else {
      await opts.onChange(null, null);
    }
  });

  return { signIn: signInWithGoogle, signOut: signOutUser };
}
