<script lang="ts">
  import type { PageProps } from "./$types"
  import {
    MapLibre,
    GeoJSON,
    LineLayer,
    CircleLayer,
    SymbolLayer,
    FillLayer,
  } from "svelte-maplibre"
  import * as turf from "@turf/turf"
  import PoiList from "$lib/components/PoiList.svelte"
  import type { Feature, FeatureCollection, Point, Polygon, MultiPolygon } from "geojson"
  import type { PointOfInterestProperties } from "$lib/pois/index.svelte"
  import PoiMarkers from "$lib/components/PoiMarkers.svelte"
  import { onMount, onDestroy } from "svelte"
  import type { WorkerOutMessage, WalkingMinutes, IsochroneMessage } from "$lib/isochrone.worker"

  let { data }: PageProps = $props()
  let map: maplibregl.Map | undefined = $state()
  let selectedPoiId: string | null = $state(null)
  let basemap: "positron" | "dark-matter" = $state("positron")
  let rawPois: FeatureCollection<Point, PointOfInterestProperties> | null = $state(null)
  let walkingMinutes: WalkingMinutes = $state(15)
  let graphBuilt: boolean = $state(false)
  let isochrone: IsochroneMessage["isochrone"] = $state(null)
  let currentFilteredPois: IsochroneMessage["filteredPois"] = $state(null)
  let worker: Worker | null = null

  function sendCompute() {
    worker?.postMessage({
      type: "compute",
      minutes: walkingMinutes,
      features: rawPois ? $state.snapshot(rawPois.features) : null,
    })
  }

  $effect(() => {
    // reactively re-send compute when walkingMinutes changes
    walkingMinutes
    if (graphBuilt) sendCompute()
  })

  $effect(() => {
    data.pois.then((pois) => {
      rawPois = pois
      if (graphBuilt) sendCompute()
    })
  })

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
    worker = new Worker(new URL("$lib/isochrone.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data
      if (msg.type === "ready") {
        graphBuilt = true
        sendCompute()
      } else if (msg.type === "isochrone") {
        isochrone = msg.isochrone
        if (msg.filteredPois !== null) currentFilteredPois = msg.filteredPois
      }
    }

    const origins = data.stopFeatures.features.map((f) => ({
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    }))
    worker.postMessage({ type: "build", bbox: data.bbox, tilesBaseUrl: "/tiles", origins })

    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    mql.onchange = darkModeSwitched
    darkModeSwitched(mql)
  })

  onDestroy(() => {
    worker?.terminate()
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
      {#if currentFilteredPois}
        <PoiList pois={currentFilteredPois} onSelected={selectPoi} {selectedPoiId} />
      {:else}
        <p class="loading"><em>Loading points of interest...</em></p>
      {/if}
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

      {#if isochrone}
        <GeoJSON data={isochrone}>
          <FillLayer
            id="isochrone"
            paint={{
              "fill-color": "#6366f1",
              "fill-opacity": 0.2,
            }}
          />
        </GeoJSON>
      {/if}

      <div class="walking-time-control">
        <label for="walking-time">
          {#if graphBuilt}
            {walkingMinutes} min walk
          {:else}
            Loading...
          {/if}
        </label>
        <input
          id="walking-time"
          type="range"
          min="5"
          max="30"
          step="5"
          disabled={!graphBuilt}
          bind:value={walkingMinutes}
        />
      </div>

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

      {#if currentFilteredPois}
        <PoiMarkers pois={currentFilteredPois} onclick={selectPoi} {selectedPoiId} />
      {/if}
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

  .walking-time-control {
    position: absolute;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    background: rgba(255, 255, 255, 0.9);
    padding: 0.5em 0.875em;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25em;
    min-width: 160px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    font-size: initial;

    label {
      font-size: 0.8em;
      font-weight: 600;
      color: #333;
      white-space: nowrap;
    }

    input[type="range"] {
      width: 100%;
      cursor: pointer;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
</style>
