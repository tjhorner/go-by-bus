#!/bin/bash

echo "Downloading OSM data for Washington state..."
wget -O data/washington-latest.osm.pbf https://download.geofabrik.de/north-america/us/washington-latest.osm.pbf

echo "Extracting bounding box from OSM data..."
osmium extract \
  -b -123.01475,46.93304,-121.601,48.59793 \
  --strategy=complete_ways \
  data/washington-latest.osm.pbf \
  -o data/bbox.osm.pbf

echo "Filtering OSM data for highways..."
osmium tags-filter data/bbox.osm.pbf w/highway -o data/has_highway.osm.pbf

echo "Filtering OSM data for walkable ways..."
osmium tags-filter --invert-match data/has_highway.osm.pbf \
  w/highway=motorway,motorway_link,trunk,trunk_link \
  w/foot=no \
  w/access=private,no \
  -o data/roads.osm.pbf

echo "Cleaning up intermediate files..."
rm data/washington-latest.osm.pbf data/bbox.osm.pbf data/has_highway.osm.pbf

echo "Building GeoJSON tiles..."
uv run python tools/build_tiles.py data/roads.osm.pbf static/tiles/
