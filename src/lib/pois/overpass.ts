import type { BBox, FeatureCollection, Point } from "geojson"
import { PoiCategory, type PointOfInterestProperties, type PoiProvider } from "./index.svelte"
import * as turf from "@turf/turf"
import { indexedDBCache, type Cache } from "../cache"
import { getPresetName } from "./id-presets"

export interface OverpassResponse {
  version: number
  generator: string
  elements: OverpassElement[]
}

export interface OverpassElementBase {
  id: number
  tags?: { [key: string]: string }
}

export type OverpassNode = OverpassElementBase & {
  type: "node"
  lat: number
  lon: number
}

export type OverpassWay = OverpassElementBase & {
  type: "way"
  center?: Center
  nodes: number[]
}

export type OverpassElement = OverpassNode | OverpassWay

export interface Center {
  lat: number
  lon: number
}

export class OverpassClient {
  readonly #cache: Cache

  constructor(cache: Cache) {
    this.#cache = cache
  }

  async fetchPois(bbox: BBox): Promise<OverpassResponse> {
    const cacheKey = `overpass:pois:${bbox.join(",")}`
    const cached = await this.#cache.get<OverpassResponse>(cacheKey)
    if (cached) return cached

    const result = await this.query(
      `(
        nwr[amenity=restaurant][name];
        nwr[amenity=cafe][name];
        nwr[amenity=fast_food][name];
        nwr[amenity=bar][name];
        nwr[amenity=pub][name];
        nwr[amenity=food_court][name];
        nwr[amenity=cinema][name];
        nwr[leisure][name];
        nwr[shop][name];
        nwr[tourism=museum][name];
        nwr[tourism=attraction][name];
        nwr[tourism=gallery][name];
        nwr[tourism=theme_park][name];
        nwr[tourism=zoo][name];
        nwr[tourism=picnic_site][name];
        nwr[tourism=viewpoint][name];
      )`,
      bbox
    )

    await this.#cache.set(cacheKey, result)
    return result
  }

  private async query(
    query: string,
    bbox: BBox,
    outputCmd = "out center;"
  ): Promise<OverpassResponse> {
    const convertedBbox = [bbox[1], bbox[0], bbox[3], bbox[2]]
    const queryBody = `[out:json][timeout:60][bbox:${convertedBbox.join(",")}];${query};${outputCmd}`

    const overpassHosts = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ]

    const maxRetries = 3
    const baseDelay = 1000

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      for (const host of overpassHosts) {
        try {
          const response = await fetch(host, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `data=${encodeURIComponent(queryBody)}`,
          })

          if (response.ok) {
            return response.json() as Promise<OverpassResponse>
          }
        } catch (error) {
          console.warn(`Overpass API request failed on host ${host}:`, error)
        }
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw new Error("Failed to query Overpass API after retries")
  }
}

export class OverpassPoiProvider implements PoiProvider {
  readonly #client: OverpassClient

  constructor(client: OverpassClient) {
    this.#client = client
  }

  async getPois(bbox: BBox): Promise<FeatureCollection<Point, PointOfInterestProperties>> {
    const response = await this.#client.fetchPois(bbox)

    const features = response.elements.map((element) => {
      const tags = element.tags!
      const properties: PointOfInterestProperties = {
        name: tags.name!,
        category: this.getCategory(tags),
        subcategory: getPresetName(tags),
        description: tags.description,
        address: this.getFullAddress(tags),
        urls: Object.values(tags).filter((value) => value.startsWith("http")),
        phone: tags.phone,
      }

      const coordinates =
        element.type === "node"
          ? [element.lon, element.lat]
          : [element.center!.lon, element.center!.lat]

      return turf.point(coordinates, properties, { id: element.id.toString() })
    })

    return turf.featureCollection(features)
  }

  private getFullAddress(tags: { [key: string]: string }): string | undefined {
    const addressParts = [
      tags["addr:housenumber"],
      tags["addr:street"],
      tags["addr:city"],
      tags["addr:state"],
      tags["addr:country"],
    ].filter(Boolean)

    return addressParts.length > 0 ? addressParts.join(" ") : undefined
  }

  private getCategory(tags: { [key: string]: string }): PoiCategory {
    if (tags.leisure) return PoiCategory.Leisure
    if (tags.shop) return PoiCategory.Shopping
    if (tags.tourism) return PoiCategory.Tourism

    if (tags.amenity) {
      switch (tags.amenity) {
        case "restaurant":
        case "cafe":
        case "fast_food":
        case "bar":
        case "pub":
        case "food_court":
          return PoiCategory.Food
        case "cinema":
          return PoiCategory.Entertainment
      }
    }

    return PoiCategory.Other
  }
}

export const overpassClient = new OverpassClient(indexedDBCache)
export const overpassPoiProvider = new OverpassPoiProvider(overpassClient)
