<script lang="ts">
  import type { PageProps } from "./$types"
  import { goto } from "$app/navigation"
  import TypeaheadSearch from "$lib/components/TypeaheadSearch.svelte"

  let { data }: PageProps = $props()
  let disabled = $state(false)
</script>

<div class="container">
  <div class="details">
    <h1>Go By Bus</h1>

    <p>
      Are you the type of person that wants to ride a new bus route just for the sake of it? Or
      maybe you live near a route and you're not sure where it goes?
    </p>

    <p>Pick a route below and we'll show you some interesting places you can get to from it.</p>

    {#await data.routes}
      <p class="center"><em>Just a sec, loading routes...</em></p>
    {:then routes}
      <TypeaheadSearch
        {routes}
        {disabled}
        onSelect={(route) => {
          disabled = true
          goto(`/${route.id}`)
        }}
      />
    {:catch error}
      <p class="center"><strong>Failed to load routes: {error.message}</strong></p>
    {/await}

    <h2>How does this work?</h2>

    <p>
      Route data is sourced from <a
        href="https://www.soundtransit.org/help-contacts/business-information/open-transit-data-otd"
        target="_blank"
        rel="noopener noreferrer"
      >
        Sound Transit's OneBusAway instance</a
      >
      and points of interest are sourced from
      <a href="https://www.openstreetmap.org/about" target="_blank" rel="noopener noreferrer"
        >OpenStreetMap</a
      >. This project is open source on
      <a href="https://github.com/tjhorner/go-by-bus" target="_blank" rel="noopener noreferrer"
        >GitHub</a
      >.
    </p>
  </div>
</div>

<style>
  p {
    line-height: 1.5;
  }

  .container {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1em;
  }

  .details {
    width: 100%;
    max-width: 700px;
    padding: 0 1em;
  }

  .center {
    text-align: center;
  }
</style>
