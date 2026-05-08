<script lang="ts">
  import {
    PoiCategory,
    poiCategoryIcons,
    type PointOfInterestProperties,
  } from "$lib/pois/index.svelte"
  import type { Feature, FeatureCollection, Point } from "geojson"
  import { GeoJSON, MarkerLayer, Popup, getMapContext } from "svelte-maplibre"
  import type { GeoJSONSource } from "maplibre-gl"

  interface Props {
    pois: FeatureCollection<Point, PointOfInterestProperties>
    selectedPoiId?: string | null
    onclick?: (poi: Feature<Point, PointOfInterestProperties>) => void
  }

  let { pois, selectedPoiId, onclick }: Props = $props()

  let hoveredPoi = $state<Feature<Point, PointOfInterestProperties> | undefined>(undefined)

  let selectedPoi = $derived(
    selectedPoiId ? (pois.features.find((f) => f.id!.toString() === selectedPoiId) ?? null) : null
  )

  let hoverPopupFeature = $derived(
    hoveredPoi && hoveredPoi.id?.toString() !== selectedPoiId ? hoveredPoi : null
  )

  const { map } = $derived(getMapContext())

  async function expandCluster(feature: Feature) {
    if (!map) return
    const source = map.getSource("pois") as GeoJSONSource
    const zoom = await source.getClusterExpansionZoom(feature.properties?.cluster_id)
    const [lng, lat] = (feature.geometry as Point).coordinates
    map.easeTo({ center: [lng, lat], zoom })
  }
</script>

{#snippet poiPopup(feature: Feature<Point, PointOfInterestProperties>)}
  <Popup
    lngLat={feature.geometry.coordinates as [number, number]}
    popupClass="poi-hover-popup"
    offset={[0, -15]}
    openOn="manual"
    open={true}
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
{/snippet}

<GeoJSON id="pois" data={pois} cluster={{ radius: 50, maxZoom: 14 }}>
  <MarkerLayer applyToClusters={true} onclick={({ feature }) => expandCluster(feature)}>
    {#snippet children({ feature })}
      <div class="cluster">
        {feature.properties?.point_count_abbreviated}
      </div>
    {/snippet}
  </MarkerLayer>

  <MarkerLayer
    applyToClusters={false}
    bind:hovered={hoveredPoi}
    zIndex={(feature) => (feature.id?.toString() === selectedPoiId ? 1000 : 0)}
    onclick={({ feature }) =>
      onclick?.(feature as unknown as Feature<Point, PointOfInterestProperties>)}
  >
    {#snippet children({ feature })}
      {@const props = feature.properties as PointOfInterestProperties}
      {@const Icon = poiCategoryIcons[props?.category || PoiCategory.Other]}
      {@const selected = feature.id?.toString() === selectedPoiId}
      <div
        class="marker"
        class:selected
        style={`background-color: var(--poi-color-${props.category})`}
      >
        <Icon size={16} />
      </div>
    {/snippet}
  </MarkerLayer>

  {#if selectedPoi}{@render poiPopup(selectedPoi)}{/if}
  {#if hoverPopupFeature}{@render poiPopup(hoverPopupFeature)}{/if}
</GeoJSON>

<style>
  .cluster {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2em;
    height: 2em;
    border-radius: 50%;
    background-color: var(--color-bg);
    border: 2px solid var(--color-border);
    font-size: 1.5em;
    font-weight: bold;
    cursor: pointer;
  }

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
