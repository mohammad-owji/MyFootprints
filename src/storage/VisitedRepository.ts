/**
 * Storage abstraction for the set of visited countries.
 *
 * Everything that touches persistence goes through this interface. Today it is
 * backed by localStorage; swapping to a REST/DB backend later only requires a
 * new implementation of `VisitedRepository` — no call site changes.
 *
 * The API is async on purpose so a network-backed implementation is a drop-in
 * replacement (the localStorage version simply resolves immediately).
 */

/** ISO 3166-1 numeric country id, kept as a string (matches the TopoJSON ids). */
export type CountryId = string;

export interface VisitedRepository {
  /** All currently-visited country ids. */
  getVisited(): Promise<Set<CountryId>>;
  /** Toggle a country and resolve with its new visited state. */
  toggleVisited(id: CountryId): Promise<boolean>;
  /** Replace the full set of visited ids. */
  setVisited(ids: CountryId[]): Promise<void>;
}
