import * as turf from "@turf/turf"
import type {
  Feature,
  FeatureCollection,
  LineString,
  Polygon,
  MultiPolygon,
  Position,
} from "geojson"

type NodeId = number

interface RoutingGraph {
  nodes: Map<NodeId, Position>
  adjacency: Map<NodeId, Array<{ to: NodeId; seconds: number }>>
}

const WALKING_SPEED_MPS = 1.39 // ~5 km/h

class MinHeap<T> {
  private items: { priority: number; value: T }[] = []

  get size() {
    return this.items.length
  }

  push(priority: number, value: T) {
    this.items.push({ priority, value })
    this.bubbleUp(this.items.length - 1)
  }

  pop(): { priority: number; value: T } | undefined {
    if (this.items.length === 0) return undefined
    const top = this.items[0]
    const last = this.items.pop()!
    if (this.items.length > 0) {
      this.items[0] = last
      this.sinkDown(0)
    }
    return top
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.items[parent].priority <= this.items[i].priority) break
      ;[this.items[parent], this.items[i]] = [this.items[i], this.items[parent]]
      i = parent
    }
  }

  private sinkDown(i: number) {
    const n = this.items.length
    while (true) {
      const left = 2 * i + 1
      const right = 2 * i + 2
      let smallest = i
      if (left < n && this.items[left].priority < this.items[smallest].priority) smallest = left
      if (right < n && this.items[right].priority < this.items[smallest].priority) smallest = right
      if (smallest === i) break
      ;[this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]]
      i = smallest
    }
  }
}

function distanceMeters(a: Position, b: Position): number {
  const cosLat = Math.cos(((a[1] + b[1]) * Math.PI) / 360)
  const dx = (b[0] - a[0]) * cosLat * 111_319.5
  const dy = (b[1] - a[1]) * 111_319.5
  return Math.sqrt(dx * dx + dy * dy)
}

function buildGraph(roads: FeatureCollection<LineString>): RoutingGraph {
  const nodes = new Map<NodeId, Position>()
  const adjacency = new Map<NodeId, Array<{ to: NodeId; seconds: number }>>()
  const coordToId = new Map<string, NodeId>()
  let nextId = 0

  const getNodeId = (lon: number, lat: number): NodeId => {
    const key = `${lon},${lat}`
    let id = coordToId.get(key)
    if (id === undefined) {
      id = nextId++
      coordToId.set(key, id)
      nodes.set(id, [lon, lat])
    }
    return id
  }

  const addEdge = (from: NodeId, to: NodeId, seconds: number) => {
    const list = adjacency.get(from)
    if (list) list.push({ to, seconds })
    else adjacency.set(from, [{ to, seconds }])
  }

  for (const feature of roads.features) {
    const coords = feature.geometry.coordinates
    for (let i = 0; i < coords.length - 1; i++) {
      const from = coords[i]
      const to = coords[i + 1]
      const fromId = getNodeId(from[0], from[1])
      const toId = getNodeId(to[0], to[1])
      const seconds = distanceMeters(from, to) / WALKING_SPEED_MPS
      addEdge(fromId, toId, seconds)
      addEdge(toId, fromId, seconds)
    }
  }

  return { nodes, adjacency }
}

function findLargestComponent(graph: RoutingGraph): Set<NodeId> {
  const visited = new Set<NodeId>()
  let largest = new Set<NodeId>()

  for (const start of graph.nodes.keys()) {
    if (visited.has(start)) continue

    const component = new Set<NodeId>()
    const stack = [start]
    while (stack.length > 0) {
      const node = stack.pop()!
      if (component.has(node)) continue
      component.add(node)
      visited.add(node)
      for (const { to } of graph.adjacency.get(node) ?? []) {
        if (!component.has(to)) stack.push(to)
      }
    }

    if (component.size > largest.size) largest = component
  }

  return largest
}

interface SpatialGrid {
  cells: Map<string, NodeId[]>
  cellSizeDeg: number
}

function buildSpatialGrid(
  candidates: Set<NodeId>,
  graph: RoutingGraph,
  cellSizeMeters: number
): SpatialGrid {
  const cellSizeDeg = cellSizeMeters / 111_319.5
  const cells = new Map<string, NodeId[]>()

  for (const id of candidates) {
    const [lon, lat] = graph.nodes.get(id)!
    const key = `${Math.floor(lon / cellSizeDeg)},${Math.floor(lat / cellSizeDeg)}`
    const cell = cells.get(key)
    if (cell) cell.push(id)
    else cells.set(key, [id])
  }

  return { cells, cellSizeDeg }
}

function snapToNearestNode(
  origin: Position,
  graph: RoutingGraph,
  grid: SpatialGrid,
  maxMeters: number
): NodeId | null {
  const { cells, cellSizeDeg } = grid
  const cx = Math.floor(origin[0] / cellSizeDeg)
  const cy = Math.floor(origin[1] / cellSizeDeg)
  // +1 to ensure we don't miss nodes just across a cell boundary
  const radius = Math.ceil(maxMeters / 111_319.5 / cellSizeDeg) + 1

  let bestId: NodeId | null = null
  let bestDistance = Infinity

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const cell = cells.get(`${cx + dx},${cy + dy}`)
      if (!cell) continue
      for (const id of cell) {
        const distance = distanceMeters(origin, graph.nodes.get(id)!)
        if (distance < bestDistance) {
          bestDistance = distance
          bestId = id
        }
      }
    }
  }

  return bestDistance <= maxMeters ? bestId : null
}

function multiSourceDijkstra(
  graph: RoutingGraph,
  sources: NodeId[],
  maxSeconds: number
): Map<NodeId, number> {
  const cost = new Map<NodeId, number>()
  const heap = new MinHeap<NodeId>()
  for (const source of sources) heap.push(0, source)

  while (heap.size > 0) {
    const { priority: currentCost, value: node } = heap.pop()!
    if (cost.has(node)) continue
    cost.set(node, currentCost)

    for (const { to, seconds } of graph.adjacency.get(node) ?? []) {
      const nextCost = currentCost + seconds
      if (nextCost <= maxSeconds && !cost.has(to)) {
        heap.push(nextCost, to)
      }
    }
  }

  return cost
}

function reachedNodesToPolygon(
  reached: Map<NodeId, number>,
  graph: RoutingGraph,
  concaveMaxEdgeKm: number
): Feature<Polygon | MultiPolygon> | null {
  if (reached.size < 3) return null

  const cellSizeDeg = concaveMaxEdgeKm / 3 / 111.3195
  const seen = new Set<string>()
  const sampled: [number, number][] = []
  for (const id of reached.keys()) {
    const [lon, lat] = graph.nodes.get(id)!
    const key = `${Math.floor(lon / cellSizeDeg)},${Math.floor(lat / cellSizeDeg)}`
    if (!seen.has(key)) {
      seen.add(key)
      sampled.push([lon, lat])
    }
  }

  if (sampled.length < 3) return null

  const points = turf.featureCollection(sampled.map(([lon, lat]) => turf.point([lon, lat])))
  return turf.concave(points, { maxEdge: concaveMaxEdgeKm, units: "kilometers" })
}

export interface IsochroneOptions {
  concaveMaxEdgeKm?: number
  snapMaxMeters?: number
}

export interface BuiltIsochroneGraph {
  graph: RoutingGraph
  snapped: NodeId[]
}

function clipRoadsToBbox(
  roads: FeatureCollection<LineString>,
  [minLon, minLat, maxLon, maxLat]: [number, number, number, number]
): FeatureCollection<LineString> {
  const features = roads.features.filter((feature) =>
    feature.geometry.coordinates.some(
      ([lon, lat]) => lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat
    )
  )
  return { type: "FeatureCollection", features }
}

export function buildIsochroneGraph(
  roads: FeatureCollection<LineString>,
  origins: Position[],
  bbox: [number, number, number, number],
  options: IsochroneOptions = {}
): BuiltIsochroneGraph {
  const clipped = clipRoadsToBbox(roads, bbox)
  const graph = buildGraph(clipped)
  const largestComponent = findLargestComponent(graph)
  const snapMaxMeters = options.snapMaxMeters ?? 100
  const grid = buildSpatialGrid(largestComponent, graph, snapMaxMeters)
  const snapped = [
    ...new Set(
      origins
        .map((o) => snapToNearestNode(o, graph, grid, snapMaxMeters))
        .filter((id): id is NodeId => id !== null)
    ),
  ]
  return { graph, snapped }
}

export function computeIsochrone(
  built: BuiltIsochroneGraph,
  maxMinutes: number,
  options: IsochroneOptions = {}
): Feature<Polygon | MultiPolygon> | null {
  if (built.snapped.length === 0) return null
  const maxEdge = options.concaveMaxEdgeKm ?? 0.3
  const reached = multiSourceDijkstra(built.graph, built.snapped, maxMinutes * 60)
  return reachedNodesToPolygon(reached, built.graph, maxEdge)
}
