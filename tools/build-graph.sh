#!/bin/bash

mkdir -p data static/tiles

echo "Downloading OSM data for Washington state..."
wget -O data/washington-latest.osm.pbf https://download.geofabrik.de/north-america/us/washington-latest.osm.pbf

echo "Building GeoJSON tiles..."
uv run python tools/build_tiles.py \
  data/washington-latest.osm.pbf static/tiles/ \
  --bbox="-123.01475,46.93304,-121.601,48.59793"

echo "Cleaning up OSM data file..."
rm data/washington-latest.osm.pbf
