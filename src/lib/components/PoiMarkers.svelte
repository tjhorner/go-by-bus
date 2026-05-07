<script lang="ts">
  import {
    PoiCategory,
    poiCategoryIcons,
    type PointOfInterestProperties,
  } from "$lib/pois/index.svelte"
  import type { Feature, FeatureCollection, Point } from "geojson"
  import { Marker, Popup } from "svelte-maplibre"

  interface Props {
    pois: FeatureCollection<Point, PointOfInterestProperties>
    selectedPoiId?: string | null
    onclick?: (poi: Feature<Point, PointOfInterestProperties>) => void
  }

  let { pois, selectedPoiId, onclick }: Props = $props()
</script>

{#each pois.features as feature}
  {@const Icon = poiCategoryIcons[feature.properties?.category || PoiCategory.Other]}
  {@const selected = feature.id!.toString() === selectedPoiId}
  <Marker
    lngLat={feature.geometry.coordinates as [number, number]}
    class={selected ? "poi-marker-selected" : ""}
    onclick={() => onclick?.(feature)}
  >
    <div
      class="marker"
      class:selected
      style={`background-color: var(--poi-color-${feature.properties.category})`}
    >
      <Icon size={16} />
    </div>

    <Popup
      popupClass="poi-hover-popup"
      offset={[0, -15]}
      openOn={selected ? "manual" : "hover"}
      open={selected}
      closeButton={false}
      closeOnMove={false}
      closeOnClickInside={false}
      closeOnClickOutside={false}
    >
      <strong>{feature.properties?.name}</strong>
      {#if feature.properties?.subcategory}
        <div class="muted">{feature.properties.subcategory}</div>
      {/if}
    </Popup>
  </Marker>
{/each}

<style>
  .marker {
    display: flex;
    padding: 0.25em;
    border-radius: 3px;
    cursor: pointer;
    border: 2px solid var(--color-bg);

    &.selected {
      transform: scale(1.25);
    }
  }

  strong {
    font-size: 1.2em;
  }

  .muted {
    display: block;
    color: var(--color-text-muted);
  }

  :global(.poi-marker-selected) {
    z-index: 1000;
  }

  :global(.poi-hover-popup .maplibregl-popup-content) {
    text-align: center;
    padding: 0.5em 0.75em;
    pointer-events: none;
    background: var(--color-bg);
  }

  :global(.poi-hover-popup .maplibregl-popup-tip) {
    display: none;
  }
</style>
