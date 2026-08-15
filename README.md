# nest-template

A NestJS starter for HTTP backends. It ships with Fastify, validated configuration, structured logging, request IDs, Zod validation, a consistent error shape, optional Swagger, and Docker.

Authentication and databases are **not** included. Projects differ on both, so they are left out of this starter.

## Setup

Requirements: **Node.js 24.19.0** (see `.nvmrc`) and **pnpm**.

```bash
pnpm install
cp example.env .env
pnpm start:dev
```

With defaults, the app listens on `http://localhost:3000/api/v1`.

| Script                                          | Purpose                        |
| ----------------------------------------------- | ------------------------------ |
| `pnpm start:dev`                                | Watch mode                     |
| `pnpm start:debug`                              | Watch mode with the debugger   |
| `pnpm start:prod`                               | Run the compiled build         |
| `pnpm test` / `pnpm test:e2e` / `pnpm test:cov` | Unit, e2e, coverage            |
| `pnpm lint` / `pnpm format`                     | ESLint (with fix) and Prettier |

## Deployment

This repo ships a production process and a Docker image. There is no cloud-specific deploy config.

**Process** (Node 24.19.0, a `.env` next to the app):

```bash
pnpm install
pnpm build
pnpm start:prod
```

That runs `node dist/src/main`. The app listens on `0.0.0.0` and `PORT` (default `3000`).

**Docker Compose** (env from `.env`; host and container port both use `PORT`):

```bash
cp example.env .env
docker compose up --build
```

The image is multi-stage Alpine, runs as `node`, and starts `node dist/src/main` with `NODE_ENV=production`. Details: [docs/docker.md](docs/docker.md).

## Documentation

See [docs/](docs/README.md) for intent, configuration, request flow, logging, Swagger, and Docker.
