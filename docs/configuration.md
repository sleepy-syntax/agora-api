# Configuration

Env is loaded with `dotenv/config` at the top of `src/main.ts`, then validated by Nest `ConfigModule` using the Joi object in `src/configuration.ts`.

Keys are listed once in `src/constants/variables.ts` (`ENVS`) and reused in the schema.

`ConfigModule` is global (`isGlobal: true`). Validation uses `abortEarly: true`: the first Joi failure stops startup.

## Variables

| Name            | Joi type      | Allowed / notes                                                                                         | Schema default          |
| --------------- | ------------- | ------------------------------------------------------------------------------------------------------- | ----------------------- |
| `NODE_ENV`      | string        | `development`, `production`, `test`                                                                     | `development`           |
| `SWAGGER`       | boolean (Joi) | Swagger UI is registered only if the **raw env string** is `true` (see [Features](features.md#swagger)) | `false`                 |
| `GLOBAL_PREFIX` | string        | Nest global prefix                                                                                      | `api/v1`                |
| `PORT`          | number        | Listen port                                                                                             | `3000`                  |
| `LOG_LEVEL`     | string        | `debug`, `info`, `warn`, `error`                                                                        | `info`                  |
| `CLIENT_URL`    | string (URI)  | Used as the CORS `origin` in `main.ts`                                                                  | `http://localhost:3000` |

`PORT` and `GLOBAL_PREFIX` in `main.ts` also fall back to `3000` and `api/v1` if unset. `CLIENT_URL` falls back to `http://localhost:3000`.

Logger level: if `LOG_LEVEL` is unset, `src/logger.ts` uses `info` when `NODE_ENV` is `production`, otherwise `debug`. After a normal `.env` load, Joi’s default `info` applies unless you set the variable.

## `example.env`

`scripts/generate-example-env.ts` walks `ConfigurationSchema.describe()` and writes `example.env` (type, description, default). Pre-commit regenerates it.

To add an env var:

1. Add the key to `ENVS` in `src/constants/variables.ts`.
2. Add a Joi field with `.description(...)` in `src/configuration.ts`.
3. Read it where needed.
4. Run `pnpm generate:example-env` (or commit and let the hook do it).
