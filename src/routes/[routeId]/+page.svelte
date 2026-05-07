<script lang="ts">
  import type { PageProps } from "./$types"
  import { MapLibre, GeoJSON, LineLayer, CircleLayer, SymbolLayer } from "svelte-maplibre"
  import * as turf from "@turf/turf"
  import PoiList from "$lib/components/PoiList.svelte"
  import type { Feature, Point } from "geojson"
  import type { PointOfInterestProperties } from "$lib/pois/index.svelte"
  import PoiMarkers from "$lib/components/PoiMarkers.svelte"
  import { onMount } from "svelte"

  let { data }: PageProps = $props()
  let map: maplibregl.Map | undefined = $state()
  let selectedPoiId: string | null = $state(null)
  let basemap: "positron" | "dark-matter" = $state("positron")

  function getBounds(): [[number, number], [number, number]] {
    const bbox = turf.bbox(turf.buffer(data.routeFeatures, 0.5, { units: "kilometers" })!)
    return [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ]
  }

  function selectPoi(feature: Feature<Point, PointOfInterestProperties>) {
    selectedPoiId = feature.id!.toString()
    jumpToPoi(feature)
  }

  function jumpToPoi(feature: Feature<Point, PointOfInterestProperties>) {
    if (map) {
      const [lng, lat] = feature.geometry.coordinates
      map.panTo([lng, lat], { zoom: 15, duration: 500 })
    }
  }

  function darkModeSwitched(e: { matches: boolean }) {
    if (e.matches) {
      basemap = "dark-matter"
    } else {
      basemap = "positron"
    }
  }

  onMount(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    mql.onchange = darkModeSwitched
    darkModeSwitched(mql)
  })
</script>

<div class="split">
  <div class="left">
    <div class="details">
      <h3>Stuff near route {data.routeDetails.shortName}</h3>

      <p>
        Here are some places you can reach by taking route {data.routeDetails.shortName}. Browse
        around on the map or expand a category below to find something interesting!
      </p>
    </div>

    <div class="pois">
      {#await data.pois}
        <p class="loading"><em>Loading points of interest...</em></p>
      {:then pois}
        <PoiList {pois} onSelected={selectPoi} {selectedPoiId} />
      {:catch error}
        <p>Error loading points of interest: {error.message}</p>
      {/await}
    </div>
  </div>
  <div class="right">
    <a href="/" class="back-link"> &larr; Try a different route </a>
    <MapLibre
      bind:map
      bounds={getBounds()}
      class="map"
      standardControls
      style="https://basemaps.cartocdn.com/gl/{basemap}-gl-style/style.json"
    >
      <GeoJSON data={data.routeFeatures}>
        <LineLayer
          id="route"
          paint={{
            "line-color": data.routeDetails.color ?? "#ff0000",
            "line-width": 4,
          }}
        />
      </GeoJSON>

      <GeoJSON data={data.stopFeatures}>
        <CircleLayer
          id="stops"
          layout={{}}
          paint={{
            "circle-color": "rgb(23, 184, 229)",
            "circle-radius": 5,
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1,
          }}
        />

        <SymbolLayer
          id="stop-labels"
          layout={{
            "text-field": ["get", "name"],
            "text-size": 12,
            "text-offset": [0, 2],
          }}
          paint={{
            "text-color": basemap === "dark-matter" ? "#fff" : "#222",
            "text-halo-color": basemap === "dark-matter" ? "#222" : "#fff",
            "text-halo-width": 2,
          }}
          minzoom={15}
        />
      </GeoJSON>

      <GeoJSON data={data.bufferedStops!}>
        <LineLayer
          id="buffered-stops"
          paint={{
            "line-color": "#00ee00",
            "line-dasharray": [2, 2],
            "line-width": 2,
          }}
        />
      </GeoJSON>

      {#await data.pois then pois}
        <PoiMarkers {pois} onclick={selectPoi} {selectedPoiId} />
      {/await}
    </MapLibre>
  </div>
</div>

<style>
  :global(.map) {
    height: 100%;
    width: 100%;
  }

  .split {
    display: flex;
    height: 100%;

    .left {
      width: 500px;
      border-right: 1px solid var(--color-border);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .right {
      flex-grow: 1;
      overflow-y: auto;
    }

    @media (max-width: 768px) {
      flex-direction: column-reverse;
      height: 100%;

      .left {
        width: 100%;
        border-right: none;
        border-top: 1px solid var(--color-border);
        height: 100%;
      }

      .right {
        height: 75%;
      }
    }
  }

  .details {
    padding: 0.75em;
    border-bottom: 1px solid var(--color-border);

    h3 {
      margin: 0;
    }

    p {
      margin: 0.25em 0;
    }

    p:last-of-type {
      margin-bottom: 0;
    }
  }

  .pois {
    overflow-y: auto;
  }

  .loading {
    font-size: 1.2em;
    color: var(--color-text-secondary);
    padding: 1em;
    text-align: center;
  }

  .back-link {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 999;
    background: rgba(0, 192, 189, 0.8);
    padding: 0.5em 1em;
    border-radius: 5px;
    text-decoration: none;
    color: var(--color-text);
    font-weight: bold;
  }
</style>
