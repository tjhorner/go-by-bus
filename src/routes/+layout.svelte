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
  :global(:root) {
    --color-bg: white;
    --color-text: #212121;
    --color-text-secondary: #666;
    --color-text-muted: #555;
    --color-border: #ccc;
    --color-border-light: #eee;
    --color-highlight-bg: #e0f7ff;
    --color-hover-bg: #eee;
    --color-link-bg: #d1e7ff;
    --color-link-text: #004798;

    --poi-color-food: #ff6347;
    --poi-color-shopping: #1e90ff;
    --poi-color-entertainment: #ffa500;
    --poi-color-leisure: #32cd32;
    --poi-color-tourism: #ff69b4;
    --poi-color-other: #8a2be2;
  }

  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --color-bg: #1e1e1e;
      --color-text: #e8e8e8;
      --color-text-secondary: #a0a0a0;
      --color-text-muted: #909090;
      --color-border: #404040;
      --color-border-light: #333333;
      --color-highlight-bg: #1a3a4a;
      --color-hover-bg: #2a2a2a;
      --color-link-bg: #1a3a5a;
      --color-link-text: #64b5f6;

      --poi-color-food: #8b3a3a;
      --poi-color-shopping: #1a4a8a;
      --poi-color-entertainment: #804020;
      --poi-color-leisure: #2a7a2a;
      --poi-color-tourism: #8b3a5a;
      --poi-color-other: #5a3a8a;
    }
  }

  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    font-family: system-ui, sans-serif;
    background-color: var(--color-bg);
    color: var(--color-text);
  }

  :global(a) {
    color: var(--color-link-text);
  }

  :global(*, * *) {
    box-sizing: border-box;
  }
</style>
