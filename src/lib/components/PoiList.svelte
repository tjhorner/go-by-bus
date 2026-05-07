<script lang="ts">
  import {
    PoiCategory,
    poiCategoryColors,
    poiCategoryIcons,
    type PointOfInterestProperties,
  } from "$lib/pois/index.svelte"
  import type { Feature, FeatureCollection, Point } from "geojson"
  import PoiDetails from "./PoiDetails.svelte"
  import { MapPin } from "@lucide/svelte"

  interface Props {
    pois: FeatureCollection<Point, PointOfInterestProperties>
    selectedPoiId?: string | null
    onSelected?: (poi: Feature<Point, PointOfInterestProperties>) => void
  }

  let { pois, selectedPoiId, onSelected }: Props = $props()
  let poiListContainer: HTMLDivElement | null = $state(null)

  let groupedByCategory: Record<
    string,
    FeatureCollection<Point, PointOfInterestProperties>
  > = $derived.by(() => {
    const groups: Record<string, FeatureCollection<Point, PointOfInterestProperties>> = {}

    for (const key in PoiCategory) {
      // @ts-expect-error
      groups[PoiCategory[key]] = {
        type: "FeatureCollection",
        features: [],
      }
    }

    for (const feature of pois.features) {
      const category = feature.properties?.category
      if (category && groups[category]) {
        groups[category].features.push(feature)
      }
    }

    return groups
  })

  function scrollToPoi(id: string) {
    const element = poiListContainer?.querySelector(`#poi-${id}`)
    if (element) {
      const detailsEl = element.closest("details")
      if (detailsEl && detailsEl instanceof HTMLDetailsElement && !detailsEl.open) {
        detailsEl.open = true
      }

      element.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  function capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  $effect(() => {
    if (selectedPoiId) {
      scrollToPoi(selectedPoiId)
    }
  })
</script>

<div class="poi-list" bind:this={poiListContainer}>
  {#each Object.entries(groupedByCategory) as [category, { features }]}
    {@const Icon = poiCategoryIcons[category as PoiCategory] || MapPin}
    {#if features.length > 0}
      <details>
        <summary
          class="category-heading"
          style={`background-color: ${poiCategoryColors[category as PoiCategory]}`}
          aria-label={`${category} (${features.length} places)`}
          ><span class="label">
            <Icon size={16} />
            {capitalizeFirstLetter(category)} &middot; {features.length} places
          </span></summary
        >

        {#each features as feature}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            id={`poi-${feature.id}`}
            class="poi-item"
            role="button"
            tabindex="0"
            onclick={() => onSelected?.(feature)}
          >
            <PoiDetails selected={selectedPoiId === feature.id!.toString()} poi={feature} />
          </div>
        {/each}
      </details>
    {/if}
  {/each}
</div>

<style>
  .category-heading {
    padding: 0.5em;
    cursor: pointer;
    font-weight: bold;

    .label {
      display: inline-flex;
      align-items: center;
      gap: 0.5em;
      vertical-align: bottom;
    }
  }

  summary {
    position: sticky;
    top: 0px;
  }

  .poi-item {
    cursor: pointer;
  }
</style>
