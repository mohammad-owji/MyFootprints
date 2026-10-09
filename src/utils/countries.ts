import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
// world-atlas ships ISO 3166-1 numeric ids and (in v2) a `name` property.
import topology from "world-atlas/countries-110m.json";

import type { CountryId } from "@/storage/VisitedRepository";
import { COUNTRY_NAME_FALLBACKS } from "./countryNames";

export interface CountryProperties {
  name?: string;
}

export type CountryFeature = Feature<Geometry, CountryProperties> & {
  id: CountryId;
};

// Antarctica is in the dataset but is not a "country you visit" in this app's
// sense; it is excluded from the interactive map and the counter.
const ANTARCTICA_ID: CountryId = "010";

let cachedCountries: CountryFeature[] | null = null;

/** All interactive country features, sorted by name for stable iteration. */
export function getCountries(): CountryFeature[] {
  if (cachedCountries) return cachedCountries;

  const topo = topology as unknown as Topology<{
    countries: GeometryCollection<CountryProperties>;
  }>;
  const collection = feature(
    topo,
    topo.objects.countries,
  ) as unknown as FeatureCollection<Geometry, CountryProperties>;

  const result = collection.features
    .map((f) => {
      // Normalise the id to a zero-padded 3-char string so it matches the
      // stored ids and the fallback name table consistently.
      const id = String(f.id ?? "").padStart(3, "0");
      return { ...f, id } as CountryFeature;
    })
    .filter((f) => f.id !== "" && f.id !== ANTARCTICA_ID)
    .sort((a, b) => countryName(a).localeCompare(countryName(b)));

  cachedCountries = result;
  return result;
}

/** Total number of interactive countries (used as the counter denominator). */
export function totalCountryCount(): number {
  return getCountries().length;
}

/**
 * Human-readable name for a country feature. Prefers the dataset's own `name`,
 * falls back to a small lookup table by id, and finally to a generic label so
 * the UI never shows an empty string.
 */
export function countryName(f: CountryFeature): string {
  const fromData = f.properties?.name?.trim();
  if (fromData) return fromData;
  const fromTable = COUNTRY_NAME_FALLBACKS[f.id];
  if (fromTable) return fromTable;
  return `Country ${f.id}`;
}
