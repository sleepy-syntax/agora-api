# Docker

## Image

`Dockerfile` is multi-stage:

1. **base** — `node:24.19.0-alpine`, pnpm `11.15.1`
2. **deps** — production `pnpm install --frozen-lockfile --ignore-scripts`
3. **build** — full install (still `--ignore-scripts`) and `pnpm run build`
4. **final** — `NODE_ENV=production`, `package.json`, production `node_modules`, `dist`, user `node`, command `node dist/src/main`

`.dockerignore` keeps `.env`, tests, docs, and similar files out of the build context. Runtime env comes from Compose `env_file` (or however you run the container), not from files copied into the image.

## Compose

`docker-compose.yaml` defines service `nest-template`:

- image `nest-template:latest`, build from this Dockerfile
- `restart: unless-stopped`
- `stop_grace_period: 15s` (fits Nest shutdown hooks)
- `env_file: .env`
- ports `${PORT}:${PORT}` — host and container port both come from `PORT` in the environment Compose uses (typically `.env`)

Example:

```bash
cp example.env .env
docker compose up --build
```

The app already listens on `0.0.0.0`, which is what you want inside a container.
