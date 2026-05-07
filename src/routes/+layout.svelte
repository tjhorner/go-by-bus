<script lang="ts">
  import favicon from "$lib/assets/favicon.svg"

  let { children } = $props()
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>Go By Bus</title>
</svelte:head>

{@render children()}

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    font-family: system-ui, sans-serif;
  }

  :global(*, * *) {
    box-sizing: border-box;
  }
</style>
