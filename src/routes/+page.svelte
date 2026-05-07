<script lang="ts">
  import type { PageProps } from "./$types"
  import { goto } from "$app/navigation"
  import TypeaheadSearch from "$lib/components/TypeaheadSearch.svelte"

  let { data }: PageProps = $props()
  let disabled = $state(false)
</script>

<div class="container">
  <h1>Go By Bus</h1>

  <p>Find me an excuse to take...</p>

  {#await data.routes then routes}
    <TypeaheadSearch
      {routes}
      {disabled}
      onSelect={(route) => {
        disabled = true
        goto(`/${route.id}`)
      }}
    />
  {/await}
</div>

<style>
  h1 {
    margin: 0;
  }

  .container {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1em;
    padding: 2em;
  }
</style>
