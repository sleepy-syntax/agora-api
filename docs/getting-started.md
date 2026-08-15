# Getting started

## Requirements

- Node.js **24.19.0** (`.nvmrc`; the Dockerfile uses the same version)
- **pnpm** (this repo has `pnpm-lock.yaml`)

## First run

```bash
pnpm install
cp example.env .env
pnpm start:dev
```

`example.env` is generated from the Joi schema in `src/configuration.ts`. Copy it to `.env` and change values for your machine. Do not commit `.env`.

Default listen URL (from schema defaults):

`http://localhost:3000/api/v1`

The sample route is `GET /` on the app controller, so with the default prefix that is:

`GET http://localhost:3000/api/v1`

Response body: `Hello World!`

The process binds to `0.0.0.0` so it is reachable from Docker and other hosts, not only localhost.

## Scripts

Defined in `package.json`:

| Script                                   | What it does                                         |
| ---------------------------------------- | ---------------------------------------------------- |
| `start`                                  | `nest start` (no watch)                              |
| `start:dev`                              | Watch mode                                           |
| `start:debug`                            | Watch mode with `--debug`                            |
| `start:prod`                             | `node dist/src/main` after `pnpm build`              |
| `build`                                  | `nest build`                                         |
| `lint`                                   | ESLint with `--fix` on `src`, `apps`, `libs`, `test` |
| `format`                                 | Prettier on `src/**/*.ts` and `test/**/*.ts`         |
| `test`                                   | Jest unit tests (`src/**/*.spec.ts`)                 |
| `test:watch` / `test:cov` / `test:debug` | Watch, coverage, inspect                             |
| `test:e2e`                               | Jest with `test/jest-e2e.json`                       |
| `generate:example-env`                   | Rewrite `example.env` from the Joi schema            |
| `prepare`                                | Install Husky hooks                                  |

`pnpm build` emits `dist/src/main.js`. `start:prod` and the Docker image both run `node dist/src/main`.

## Tests

- `pnpm test` — Jest, `rootDir: src`, files matching `*.spec.ts`. The template does not ship those files yet.
- `pnpm test:e2e` — Jest with `test/jest-e2e.json`, files matching `*.e2e-spec.ts`.

The e2e suite (`test/app.e2e-spec.ts`) builds `AppModule` on `FastifyAdapter`, calls `init()` and Fastify `ready()`, then `GET /` and expects `200` and `Hello World!`. It does not run `main.ts`, so it does not apply the global prefix, Helmet, CORS, Swagger, or the global pipes and filter from bootstrap.

## Tooling on commit

`.husky/pre-commit` runs `pnpm format`, `pnpm lint`, `pnpm generate:example-env`, then `git add example.env`. If you change env schema descriptions or defaults, the example file updates on the next commit.
