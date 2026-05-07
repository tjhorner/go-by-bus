import { overpassPoiProvider } from "$lib/pois/overpass"
import { transitData } from "$lib/transit/data-provider"
import type { Feature, Point } from "geojson"
import type { PageLoad } from "./$types"
import * as turf from "@turf/turf"

export const load: PageLoad = async ({ params }) => {
  const { routeId } = params

  const [routeDetails, routeFeatures] = await Promise.all([
    transitData.getRoute(routeId),
    transitData.getRouteFeatures(routeId),
  ])

  const stopFeatures = turf.featureCollection<Point>(
    routeFeatures.features.filter((f) => f.geometry.type === "Point") as Feature<Point>[]
  )

  const bufferedStops = turf.union(turf.buffer(stopFeatures, 0.5, { units: "kilometers" })!)!

  const bbox = turf.bbox(bufferedStops)

  return {
    routeDetails,
    stopFeatures,
    routeFeatures,
    bufferedStops,
    pois: overpassPoiProvider.getPois(bbox).then(({ features }) =>
      turf.featureCollection(
        features
          .filter((feature) => turf.booleanIntersects(feature, bufferedStops))
          .map((feature) => {
            const nearestStop = turf.nearestPoint(feature, stopFeatures)
            const distanceFromNearestStop = turf.distance(feature, nearestStop, {
              units: "meters",
            })

            return {
              ...feature,
              properties: {
                ...feature.properties,
                distanceFromNearestStop,
              },
            }
          })
          .sort((a, b) => {
            const distA = a.properties?.distanceFromNearestStop ?? Infinity
            const distB = b.properties?.distanceFromNearestStop ?? Infinity
            return distA - distB
          })
      )
    ),
  }
}
