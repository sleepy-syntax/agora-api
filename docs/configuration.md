# Configuration

Env is loaded with `dotenv/config` at the top of `src/main.ts`, then validated by Nest `ConfigModule` using the Joi object in `src/configuration.ts`.

Keys are listed once in `src/constants/variables.ts` (`ENVS`) and reused in the schema.

`ConfigModule` is global (`isGlobal: true`). Validation uses `abortEarly: true`: the first Joi failure stops startup.

## Variables

| Name                      | Joi type                     | Allowed / notes                                                                                         | Schema default          |
| ------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------- |
| `NODE_ENV`                | string                       | `development`, `production`, `test`                                                                     | `development`           |
| `SWAGGER`                 | boolean (Joi)                | Swagger UI is registered only if the **raw env string** is `true` (see [Features](features.md#swagger)) | `false`                 |
| `GLOBAL_PREFIX`           | string                       | Nest global prefix                                                                                      | `api/v1`                |
| `PORT`                    | number                       | Listen port                                                                                             | `3000`                  |
| `LOG_LEVEL`               | string                       | `debug`, `info`, `warn`, `error`                                                                        | `info`                  |
| `CLIENT_URL`              | string (URI)                 | Used as the CORS `origin` in `main.ts` and on the socket gateway                                        | `http://localhost:3000` |
| `SOCKET_PATH`             | string                       | Socket.IO path. Must start with `/`. Not under the HTTP prefix                                          | `/socket.io`            |
| `MONGODB_URI`             | string (URI)                 | Required                                                                                                | —                       |
| `MONGODB_DB_NAME`         | string                       | Required                                                                                                | —                       |
| `REDIS_HOST`              | string                       | Required                                                                                                | —                       |
| `REDIS_PORT`              | number                       | Required                                                                                                | —                       |
| `REDIS_PASSWORD`          | string                       | Required                                                                                                | —                       |
| `STUN_URLS`               | string (custom → `string[]`) | Required. Comma-separated. At least one URL after trim. No default.                                     | —                       |
| `TURN_URLS`               | string (custom → `string[]`) | Required. Comma-separated. At least one URL after trim.                                                 | —                       |
| `TURN_USERNAME`           | string (custom, trimmed)     | Required. Blank after trim fails startup.                                                               | —                       |
| `TURN_PASSWORD`           | string (custom, trimmed)     | Required. Blank after trim fails startup.                                                               | —                       |
| `PAIR_BLOCK_TTL_SECONDS`  | number (integer)             | Min `1`                                                                                                 | `3600`                  |
| `PRESENCE_TTL_SECONDS`    | number (integer)             | Min `5`                                                                                                 | `15`                    |
| `CONNECT_TIMEOUT_SECONDS` | number (integer)             | Min `5`                                                                                                 | `20`                    |
| `STATS_CACHE_TTL_SECONDS` | number (integer)             | Min `1`                                                                                                 | `10`                    |

In `.env`, `STUN_URLS` and `TURN_URLS` are comma-separated strings. After Joi validation, `ConfigService.get` returns `string[]` for those keys.

`PORT` and `GLOBAL_PREFIX` in `main.ts` also fall back to `3000` and `api/v1` if unset. `CLIENT_URL` falls back to `http://localhost:3000`. `SOCKET_PATH` on the gateway falls back to `/socket.io`.

Logger level: if `LOG_LEVEL` is unset, `src/logger.ts` uses `info` when `NODE_ENV` is `production`, otherwise `debug`. After a normal `.env` load, Joi’s default `info` applies unless you set the variable.

## Constants (not env)

Defined in `src/constants/variables.ts`:

| Name                             | Value        | Used for                                     |
| -------------------------------- | ------------ | -------------------------------------------- |
| `REVIEW_COMMENT_MAX_LENGTH`      | `1000`       | Max trimmed length on `POST /api/v1/reviews` |
| `RATE_LIMITS.queueJoinPerClient` | 10 per 60s   | Socket `queue.join` (step 12)                |
| `RATE_LIMITS.queueJoinPerIp`     | 30 per 60s   | Socket `queue.join` (step 12)                |
| `RATE_LIMITS.reviewsPerIp`       | 10 per 3600s | `POST /api/v1/reviews` (step 12)             |

## `example.env`

`scripts/generate-example-env.ts` walks `ConfigurationSchema.describe()` and writes `example.env` (type, description, default). Pre-commit regenerates it.

To add an env var:

1. Add the key to `ENVS` in `src/constants/variables.ts`.
2. Add a Joi field with `.description(...)` in `src/configuration.ts`.
3. Read it where needed.
4. Run `pnpm generate:example-env` (or commit and let the hook do it).
