import type { Feature, FeatureCollection, Geometry, LineString } from "geojson"
import OnebusawaySDK from "onebusaway-sdk"
import polyline from "@mapbox/polyline"
import * as turf from "@turf/turf"
import { orderBy } from "natural-orderby"
import { sessionStorageCache, type Cache } from "../cache"

export interface Route {
  id: string
  shortName?: string
  longName?: string
  color?: string
  textColor?: string
}

export interface AgencyWithRoutes {
  id: string
  name: string
  routes: Route[]
}

export interface TransitDataProvider {
  getRoutes(): Promise<AgencyWithRoutes[]>
  getRoute(routeId: string): Promise<Route>
  getRouteFeatures(routeId: string): Promise<FeatureCollection>
}

class OBADataProvider implements TransitDataProvider {
  readonly #client: OnebusawaySDK
  readonly #cache: Cache

  constructor(cache: Cache) {
    this.#cache = cache
    this.#client = new OnebusawaySDK({
      apiKey: "5654bb33-edab-4322-8688-94b9d262abe4",
      fetch: (input, init) => {
        if (init?.headers) {
          for (const key of Object.keys(init.headers)) {
            // these headers mess with CORS preflight requests
            if (
              key.toLowerCase().startsWith("x-stainless-") ||
              key.toLowerCase() === "user-agent"
            ) {
              // @ts-expect-error
              delete init.headers[key]
            }
          }
        }

        return fetch(input, init)
      },
    })
  }

  async getRoutes(): Promise<AgencyWithRoutes[]> {
    const cacheKey = "routes"
    const cached = await this.#cache.get<AgencyWithRoutes[]>(cacheKey)
    if (cached) {
      return cached
    }

    const agencies = await this.#client.agenciesWithCoverage.list()

    const agenciesById = Object.fromEntries(
      agencies.data.references.agencies.map((agency) => [agency.id, agency])
    )

    const routes = await Promise.all(
      agencies.data.list.map(async (agency) => ({
        id: agency.agencyId,
        name: agenciesById[agency.agencyId].name,
        routes: await this.#client.routesForAgency.list(agency.agencyId).then((response) =>
          orderBy(
            response.data.list.map((route) => ({
              id: route.id,
              shortName: route.shortName,
              longName: firstNonEmptyString(route.longName, route.description) ?? "",
            })),
            [(route) => route.shortName ?? route.longName ?? route.id],
            ["asc"]
          )
        ),
      }))
    )

    await this.#cache.set(cacheKey, routes)
    return routes
  }

  async getRoute(routeId: string): Promise<Route> {
    const cacheKey = `route:${routeId}`
    const cached = await this.#cache.get<Route>(cacheKey)
    if (cached) {
      return cached
    }

    const route = await this.#client.route.retrieve(routeId).then((response) => response.data.entry)
    const result: Route = {
      id: route.id,
      shortName: route.shortName,
      longName: firstNonEmptyString(route.longName, route.description) ?? "",
      color: route.color ? `#${route.color}` : undefined,
      textColor: route.textColor ? `#${route.textColor}` : undefined,
    }

    await this.#cache.set(cacheKey, result)
    return result
  }

  async getRouteFeatures(routeId: string): Promise<FeatureCollection> {
    const cacheKey = `routeFeatures:${routeId}`
    const cached = await this.#cache.get<FeatureCollection>(cacheKey)
    if (cached) {
      return cached
    }

    const resp = await this.#client.stopsForRoute.list(routeId)

    const shapes =
      resp.data.entry.polylines?.map((pl) => this.polylineToLineString(pl.points!)) ?? []

    const stops = resp.data.references.stops
      .filter((stop) => resp.data.entry.stopIds?.includes(stop.id))
      .map((stop) =>
        turf.point([stop.lon, stop.lat], {
          id: stop.id,
          name: stop.name,
        })
      )

    const features = turf.featureCollection<Geometry>([...shapes, ...stops])
    await this.#cache.set(cacheKey, features)
    return features
  }

  private polylineToLineString(pl: string): Feature<LineString> {
    return turf.lineString(polyline.decode(pl).map(([lat, lng]) => [lng, lat]))
  }
}

function firstNonEmptyString(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (value && value.trim() !== "") {
      return value
    }
  }
  return undefined
}

export const transitData = new OBADataProvider(sessionStorageCache)
