<script lang="ts">
  import type { AgencyWithRoutes, Route } from "$lib/transit/data-provider"
  import Fuse from "fuse.js"

  interface Props {
    routes: AgencyWithRoutes[]
    disabled?: boolean
    onSelect?: (route: Route) => void
  }

  let { routes, onSelect, disabled }: Props = $props()

  function formatDisplayName(route: Route) {
    return route.shortName ? `${route.shortName} • ${route.longName}` : route.longName
  }

  let flatRoutes = $derived(
    routes.flatMap((agency) =>
      agency.routes.map((route) => ({
        ...route,
        displayName: formatDisplayName(route),
        agencyName: agency.name,
      }))
    )
  )

  const searcher = $derived(
    new Fuse(flatRoutes, {
      keys: ["shortName", "longName", "description", "agencyName"],
      threshold: 0.3,
    })
  )

  let container: HTMLDivElement | null = $state(null)
  let query = $state("")
  let selectedIndex = $state(0)

  let results = $derived.by(() => {
    if (!query) {
      return []
    }

    return searcher.search(query).map((result) => result.item)
  })

  $effect(() => {
    if (results.length === 0) {
      selectedIndex = 0
    } else if (selectedIndex >= results.length) {
      selectedIndex = results.length - 1
    }
  })

  $effect(() => {
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      const element = container?.querySelector(`.result:nth-child(${selectedIndex + 1})`)
      if (element) {
        element.scrollIntoView({ block: "nearest" })
      }
    }
  })

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1)
      event.preventDefault()
    } else if (event.key === "ArrowUp") {
      selectedIndex = Math.max(selectedIndex - 1, 0)
      event.preventDefault()
    } else if (event.key === "Enter" && selectedIndex >= 0) {
      const selectedRoute = results[selectedIndex]
      selectRoute(selectedRoute)
      event.preventDefault()
    }
  }

  function selectRoute(route: Route & { displayName?: string }) {
    query = route.displayName!
    onSelect?.(route)
  }
</script>

<div class="typeahead" bind:this={container}>
  <input
    {disabled}
    type="text"
    placeholder="Search for a route..."
    bind:value={query}
    onkeydown={onKeyDown}
  />

  {#if results.length > 0 && !disabled}
    <div class="results">
      {#each results as route, index}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          role="link"
          class="result"
          class:active={index === selectedIndex}
          onclick={() => selectRoute(route)}
          onmouseover={() => (selectedIndex = index)}
          onfocus={() => (selectedIndex = index)}
          tabindex="-1"
        >
          <div class="name">
            <div class="route-name">{route.displayName}</div>
            <div class="agency-name">{route.agencyName}</div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .typeahead {
    position: relative;
    font-size: 1.2em;
    width: 700px;
  }

  input {
    width: 100%;
    padding: 10px;
    font-size: 1em;
  }

  .results {
    width: 100%;
    margin: 0 auto;
    position: absolute;
    top: calc(100%);
    left: 0;
    max-height: 500px;
    background: white;
    color: #212121;
    overflow: auto;
    text-align: left;
    border: 1px solid #ccc;
    border-radius: 10px;
    margin-top: 10px;
    z-index: 5;
  }

  .result {
    padding: 0.5em;
    cursor: pointer;

    &:not(:last-of-type) {
      border-bottom: 1px solid #eee;
    }

    &.active {
      background-color: #eee;
    }

    .route-name {
      font-weight: 500;
    }

    .agency-name {
      font-size: 0.8em;
      letter-spacing: 0.02em;
      color: #666;
      margin-right: 0.5em;
    }
  }
</style>
