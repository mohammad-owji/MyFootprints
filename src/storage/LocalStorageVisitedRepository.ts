import type { CountryId, VisitedRepository } from "./VisitedRepository";

const STORAGE_KEY = "myfootprints:visited";

/**
 * localStorage-backed implementation of {@link VisitedRepository}.
 *
 * The visited ids are cached in memory and mirrored to localStorage on every
 * mutation. All reads/writes are wrapped so a disabled or full storage (e.g.
 * private browsing) degrades gracefully to an in-memory-only session.
 */
export class LocalStorageVisitedRepository implements VisitedRepository {
  private cache: Set<CountryId>;

  constructor() {
    this.cache = this.load();
  }

  async getVisited(): Promise<Set<CountryId>> {
    // Return a copy so callers cannot mutate our internal state directly.
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
    this.persist();
    return nowVisited;
  }

  async setVisited(ids: CountryId[]): Promise<void> {
    this.cache = new Set(ids);
    this.persist();
  }

  private load(): Set<CountryId> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      // Coerce to string to tolerate older numeric-id payloads.
      return new Set(parsed.map((v) => String(v)));
    } catch {
      return new Set();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.cache]));
    } catch {
      // Storage unavailable/full — keep working from the in-memory cache.
    }
  }
}
