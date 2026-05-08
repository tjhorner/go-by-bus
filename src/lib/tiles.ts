import type { Feature, FeatureCollection, LineString } from "geojson"

type Bbox = readonly [number, number, number, number] // [minLng, minLat, maxLng, maxLat]

export async function loadTilesForBbox(
  baseUrl: string,
  bbox: Bbox,
  zoom = 11
): Promise<FeatureCollection<LineString>> {
  const tiles = tilesCoveringBbox(bbox, zoom)
  const collections = await Promise.all(tiles.map(([z, x, y]) => fetchTile(baseUrl, z, x, y)))
  return {
    type: "FeatureCollection",
    features: collections.flatMap((fc) => fc?.features ?? []) as Feature<LineString>[],
  }
}

async function fetchTile(
  baseUrl: string,
  z: number,
  x: number,
  y: number
): Promise<FeatureCollection<LineString> | null> {
  const response = await fetch(`${baseUrl}/${z}/${x}/${y}.geojson`)
  if (response.status === 404) return null // empty tile, no roads here
  if (!response.ok) throw new Error(`Tile ${z}/${x}/${y}: HTTP ${response.status}`)
  return response.json() as Promise<FeatureCollection<LineString>>
}

function tilesCoveringBbox(
  [minLng, minLat, maxLng, maxLat]: Bbox,
  zoom: number
): [number, number, number][] {
  const lonLatToTile = (lng: number, lat: number): [number, number] => {
    const n = 1 << zoom
    const x = Math.floor(((lng + 180) / 360) * n)
    const latRad = (lat * Math.PI) / 180
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    )
    return [x, y]
  }
  const [xMin, yMax] = lonLatToTile(minLng, minLat)
  const [xMax, yMin] = lonLatToTile(maxLng, maxLat)
  const tiles: [number, number, number][] = []
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      tiles.push([zoom, x, y])
    }
  }
  return tiles
}
