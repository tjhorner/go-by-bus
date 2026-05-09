# Go By Bus

## Development

### Prerequisites

- Node
- pnpm
- uv

### Install Dependencies

```sh
pnpm install
uv sync --locked --all-extras --dev
```

### Generate Routing Tiles

```sh
./tools/build-graph.sh
```

### Run Development Build

```sh
pnpm dev
```
