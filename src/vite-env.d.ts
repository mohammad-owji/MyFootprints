/// <reference types="vite/client" />

// world-atlas ships raw TopoJSON files with no type declarations. We cast to
// the proper Topology type at the use site (src/utils/countries.ts).
declare module "world-atlas/*.json" {
  const topology: unknown;
  export default topology;
}

// Minimal TopoJSON type surface. @types/topojson-client imports from this
// package, but it is not reliably published separately, so we declare just the
// pieces we use. The real runtime data comes from the world-atlas .json file.
declare module "topojson-specification" {
  import type { GeoJsonProperties } from "geojson";

  export interface Objects<P = GeoJsonProperties> {
    [key: string]: GeometryObject<P>;
  }

  export interface Topology<T extends Objects = Objects> {
    type: "Topology";
    objects: T;
    arcs: number[][][];
    transform?: { scale: [number, number]; translate: [number, number] };
    bbox?: number[];
  }

  export interface GeometryObjectBase {
    type: string;
    id?: string | number;
  }

  export interface GeometryCollection<P = GeoJsonProperties>
    extends GeometryObjectBase {
    type: "GeometryCollection";
    geometries: Array<GeometryObject<P>>;
    properties?: P;
  }

  export interface GeometryObject<P = GeoJsonProperties>
    extends GeometryObjectBase {
    arcs?: unknown;
    properties?: P;
  }
}
