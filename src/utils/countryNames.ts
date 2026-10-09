import type { CountryId } from "@/storage/VisitedRepository";

/**
 * Fallback country names keyed by ISO 3166-1 numeric id.
 *
 * The world-atlas v2 dataset already carries a `name` for every country, so
 * this table is only a safety net for entries that ship without one (or for
 * older dataset versions). Add ids here if you ever see "Country NNN" in the UI.
 */
export const COUNTRY_NAME_FALLBACKS: Record<CountryId, string> = {
  "250": "France",
  "260": "French Southern Territories",
  "304": "Greenland",
  "578": "Norway",
  "834": "Tanzania",
};
