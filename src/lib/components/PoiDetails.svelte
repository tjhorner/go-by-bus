<script lang="ts">
  import type { PointOfInterestProperties } from "$lib/pois/index.svelte"
  import { Navigation, Phone } from "@lucide/svelte"
  import Globe from "@lucide/svelte/icons/globe"
  import type { Feature, Point } from "geojson"

  interface Props {
    poi: Feature<Point, PointOfInterestProperties>
    selected?: boolean
  }

  let { poi, selected }: Props = $props()

  function formatUrlForDisplay(url: string) {
    try {
      const parsed = new URL(url)
      return parsed.hostname.replace("www.", "")
    } catch (e) {
      return url
    }
  }

  function getTransitLink() {
    const qs = new URLSearchParams({
      destination: `${poi.geometry.coordinates[1]},${poi.geometry.coordinates[0]}`,
      destination_search: poi.properties.name,
    })

    const url = new URL("https://transitapp.com/en/trip")
    url.search = qs.toString()

    return url.toString()
  }
</script>

<div class="poi-details" class:selected>
  <div class="title">
    <h3>
      {poi.properties.name}
    </h3>

    <span class="muted">
      {#if poi.properties.subcategory}
        {poi.properties.subcategory} &middot;
      {/if}
      {poi.properties.distanceFromNearestStop?.toFixed(0)}m from nearest stop
    </span>
  </div>

  {#if poi.properties.address}
    <span>{poi.properties.address}</span>
  {/if}

  <div class="pills">
    <a href={getTransitLink()} target="_blank" rel="noopener noreferrer">
      <Navigation size={16} /> Navigate
    </a>

    {#if poi.properties.urls && poi.properties.urls.length > 0}
      {#each poi.properties.urls as url}
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Globe size={16} />
          {formatUrlForDisplay(url)}
        </a>
      {/each}
    {/if}

    {#if poi.properties.phone}
      <a href={`tel:${poi.properties.phone}`}>
        <Phone size={16} />
        <span>{poi.properties.phone}</span>
      </a>
    {/if}
  </div>
</div>

<style>
  .poi-details {
    padding: 0.5em;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 0.4em;

    &.selected {
      background-color: var(--color-highlight-bg);
    }
  }

  h3 {
    margin: 0;
    margin-bottom: 0.1em;
  }

  .muted {
    font-size: 0.875em;
    color: var(--color-text-secondary);
    font-weight: normal;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;

    > * {
      display: inline-flex;
      align-items: center;
      gap: 0.25em;
      padding: 0.25em 0.5em;
      background: var(--color-link-bg);
      color: var(--color-link-text);
      border-radius: 9999px;
      text-decoration: none;
      font-size: 0.875em;
      cursor: pointer;
      outline: none;
      border: none;
    }
  }
</style>
