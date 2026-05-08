#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import json
import sys
from collections import Counter
from pathlib import Path

import mercantile
import osmium
import shapely.geometry as sgeom
from shapely import STRtree

ZOOM = 11

WALKING_HIGHWAY_TYPES = {
    "footway",
    "path",
    "pedestrian",
    "living_street",
    "residential",
    "service",
    "unclassified",
    "tertiary",
    "secondary",
    "primary",
    "cycleway",
    "track",
    "steps",
    "road",
}
EXCLUDE_HIGHWAY_TYPES = {"motorway", "motorway_link", "trunk", "trunk_link"}


class WalkingWayHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.ways: list[dict] = []

    def way(self, w):
        tags = {t.k: t.v for t in w.tags}
        highway = tags.get("highway", "")
        if not highway or highway in EXCLUDE_HIGHWAY_TYPES:
            return
        if tags.get("foot") == "no" or tags.get("access") == "no":
            return
        if highway not in WALKING_HIGHWAY_TYPES:
            return

        coords = [(n.lon, n.lat) for n in w.nodes if n.location.valid()]
        if len(coords) < 2:
            return

        self.ways.append(
            {
                "id": w.id,
                "highway": highway,
                "oneway": tags.get("oneway", "no"),
                "node_ids": [n.ref for n in w.nodes],
                "coords": coords,
            }
        )


def split_at_junctions(ways: list[dict]) -> list[dict]:
    node_count: Counter = Counter()
    for way in ways:
        node_count.update(way["node_ids"])

    # nodes shared across 2+ ways are intersections; endpoints always split
    junction_nodes = {nid for nid, count in node_count.items() if count >= 2}
    for way in ways:
        if way["node_ids"]:
            junction_nodes.add(way["node_ids"][0])
            junction_nodes.add(way["node_ids"][-1])

    edges = []
    for way in ways:
        node_ids = way["node_ids"]
        coords = way["coords"]
        seg_start = 0
        for i, nid in enumerate(node_ids):
            if i == seg_start:
                continue
            if nid in junction_nodes or i == len(node_ids) - 1:
                seg_coords = coords[seg_start : i + 1]
                if len(seg_coords) >= 2:
                    geom = sgeom.LineString(seg_coords)
                    edges.append(
                        {
                            "geometry": geom,
                            "highway": way["highway"],
                            "oneway": way["oneway"],
                            "length": geom.length,
                        }
                    )
                seg_start = i
    return edges


def load_network(pbf_path: str) -> list[dict]:
    handler = WalkingWayHandler()
    handler.apply_file(pbf_path, locations=True)
    return split_at_junctions(handler.ways)


def edge_bounds(edges: list[dict]) -> tuple[float, float, float, float]:
    xs = [c[0] for e in edges for c in e["geometry"].coords]
    ys = [c[1] for e in edges for c in e["geometry"].coords]
    return min(xs), min(ys), max(xs), max(ys)


def normalize_oneway(value) -> int:
    return 1 if value in ("yes", "true", "1", "-1") else 0


def feature_for(geometry, props: dict) -> dict:
    return {
        "type": "Feature",
        "geometry": sgeom.mapping(geometry),
        "properties": {
            "highway": props.get("highway") or "unclassified",
            "oneway": normalize_oneway(props.get("oneway")),
            "length": float(props.get("length") or geometry.length),
        },
    }


def features_in_tile(edges: list[dict], tree: STRtree, tile) -> list[dict]:
    bounds = mercantile.bounds(tile)
    tile_box = sgeom.box(bounds.west, bounds.south, bounds.east, bounds.north)
    candidate_idx = tree.query(tile_box, predicate="intersects")

    features: list[dict] = []
    for i in candidate_idx:
        edge = edges[i]
        geom = edge["geometry"]
        if geom is None or geom.is_empty:
            continue
        parts = geom.geoms if geom.geom_type == "MultiLineString" else [geom]
        for part in parts:
            features.append(feature_for(part, edge))
    return features


def write_tile(out_dir: Path, gzip_file: bool, tile, features: list[dict]) -> None:
    file_name = f"{tile.y}.geojson"
    if gzip_file:
        file_name += ".gz"

    out_path = out_dir / str(tile.z) / str(tile.x) / file_name
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"type": "FeatureCollection", "features": features}
    if gzip_file:
        with gzip.open(out_path, "wt", encoding="utf-8") as f:
            json.dump(payload, f, separators=(",", ":"))
    else:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, separators=(",", ":"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_pbf", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--zoom", type=int, default=ZOOM)
    parser.add_argument("--network-type", default="walking")
    parser.add_argument(
        "--gzip",
        action="store_true",
        help="Whether to gzip the output GeoJSON files",
    )
    args = parser.parse_args()

    print(f"Reading {args.input_pbf}...", file=sys.stderr)
    edges = load_network(str(args.input_pbf))

    if not edges:
        print(
            "No edges produced. Check that the PBF actually contains roads.",
            file=sys.stderr,
        )
        return 1
    print(f"  {len(edges)} edges after junction splitting", file=sys.stderr)

    geometries = [e["geometry"] for e in edges]
    tree = STRtree(geometries)
    minx, miny, maxx, maxy = edge_bounds(edges)
    tiles = list(mercantile.tiles(minx, miny, maxx, maxy, [args.zoom]))
    print(f"  {len(tiles)} candidate tiles at zoom {args.zoom}", file=sys.stderr)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    written = 0
    for tile in tiles:
        features = features_in_tile(edges, tree, tile)
        if not features:
            continue
        write_tile(args.output_dir, args.gzip, tile, features)
        written += 1
        if written % 25 == 0:
            print(f"  ...{written} tiles written", file=sys.stderr)

    manifest = {
        "zoom": args.zoom,
        "bounds": [minx, miny, maxx, maxy],
        "tileCount": written,
        "networkType": args.network_type,
    }
    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )
    print(
        f"Done. Wrote {written} tiles + manifest.json to {args.output_dir}/",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
