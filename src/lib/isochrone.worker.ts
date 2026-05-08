import { buildIsochroneGraph, computeIsochrone } from "./isochrone"
import type { IsochroneOptions, BuiltIsochroneGraph } from "./isochrone"
import { loadTilesForBbox } from "./tiles"
import type { Feature, FeatureCollection, Point, Polygon, MultiPolygon } from "geojson"
import type { PointOfInterestProperties } from "./pois/index.svelte"
import * as turf from "@turf/turf"

type LatLon = { lat: number; lon: number }

export const WALKING_MINUTES_OPTIONS = [5, 10, 15, 20, 25, 30] as const
export type WalkingMinutes = (typeof WALKING_MINUTES_OPTIONS)[number]

export type BuildMessage = {
  type: "build"
  bbox: [number, number, number, number]
  tilesBaseUrl: string
  origins: LatLon[]
  options?: IsochroneOptions
}

export type ComputeMessage = {
  type: "compute"
  minutes: WalkingMinutes
  features: Feature<Point, PointOfInterestProperties>[] | null
}

export type WorkerInMessage = BuildMessage | ComputeMessage

export type ReadyMessage = {
  type: "ready"
}

export type IsochroneMessage = {
  type: "isochrone"
  minutes: WalkingMinutes
  isochrone: Feature<Polygon | MultiPolygon> | null
  filteredPois: FeatureCollection<Point, PointOfInterestProperties> | null
}

export type WorkerOutMessage = ReadyMessage | IsochroneMessage

let graph: BuiltIsochroneGraph | null = null
const isochroneCache = new Map<WalkingMinutes, Feature<Polygon | MultiPolygon> | null>()

function filterPois(
  features: Feature<Point, PointOfInterestProperties>[],
  iso: Feature<Polygon | MultiPolygon> | null
): FeatureCollection<Point, PointOfInterestProperties> {
  if (!iso) return turf.featureCollection([])
  return turf.featureCollection(
    features
      .filter((f) => turf.booleanIntersects(f, iso))
      .sort(
        (a, b) =>
          (a.properties?.distanceFromNearestStop ?? Infinity) -
          (b.properties?.distanceFromNearestStop ?? Infinity)
      )
  )
}

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data

  if (msg.type === "build") {
    const ways = await loadTilesForBbox(msg.tilesBaseUrl, msg.bbox)
    graph = buildIsochroneGraph(ways, msg.origins, msg.bbox, msg.options)
    isochroneCache.clear()
    self.postMessage({ type: "ready" } satisfies ReadyMessage)
  } else if (msg.type === "compute") {
    if (!graph) return
    const { minutes, features } = msg
    if (!isochroneCache.has(minutes)) {
      isochroneCache.set(minutes, computeIsochrone(graph, minutes))
    }
    const isochrone = isochroneCache.get(minutes)!
    const filteredPois = features ? filterPois(features, isochrone) : null
    self.postMessage({
      type: "isochrone",
      minutes,
      isochrone,
      filteredPois,
    } satisfies IsochroneMessage)
  }
}
