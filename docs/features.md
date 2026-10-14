# Features

Agora API is the backend/API service for Agora, a video calling and video conferencing platform. The current codebase establishes the shared NestJS HTTP foundation that future conferencing modules can build on without reimplementing configuration, logging, validation, and deployment defaults.

Product modules such as authentication, users, rooms, meetings, participants, call sessions, and media-provider integration are not implemented yet. Add a dedicated section here for each module as it lands.

## HTTP adapter (Fastify)

`src/main.ts` creates `NestFastifyApplication` with `FastifyAdapter`. There is no Express adapter in this template. E2e tests use the same Fastify adapter (`test/app.e2e-spec.ts`).

Helmet is registered with `@fastify/helmet` using that plugin’s defaults (no extra options in this repo).

Shutdown hooks are enabled (`app.enableShutdownHooks()`).

## Global prefix

`app.setGlobalPrefix(GLOBAL_PREFIX)`. Default `api/v1`. All controller routes sit under that prefix.

## CORS

`app.enableCors({ origin: CLIENT_URL, credentials: true })`.

That is a baseline default: one origin from `CLIENT_URL`. Change it when Agora needs several web origins, mobile clients, a dynamic allowlist, or a stricter CORS policy.

## Request ID

Fastify is configured with:

- header name `X-Request-Id` (`REQUEST_ID_HEADER` in `src/constants/variables.ts`)
- `genReqId: () => randomUUID()` when the client does not send one

An `onRequest` hook copies `request.id` onto the response as `X-Request-Id`.

## Validation (Zod)

`app.useGlobalPipes(new ZodValidationPipe())` from `nestjs-zod`. DTOs that use Zod (when you add them) are validated globally. Agora-specific request DTOs are not shipped yet.

## Errors

`GlobalExceptionFilter` (`src/filters/global-exception.filter.ts`) is registered globally. Response JSON:

```json
{
    "statusCode": 500,
    "message": "Internal server error",
    "errors": [{ "path": "field", "message": "..." }]
}
```

- `HttpException`: `statusCode` and `message` from the exception.
- Anything else: `500` and `Internal server error`.
- `errors` is set only for `ZodValidationException` (Zod issue path + message). Otherwise it is omitted (`undefined`).

## Swagger

`setupSwagger` in `src/swagger.ts` runs only when `process.env.SWAGGER === 'true'`. Joi may coerce `SWAGGER` for ConfigModule; **the Swagger gate is the string `true`**.

When enabled (with default prefix `api/v1` and port `3000`):

- UI: `http://localhost:3000/api/v1/docs`
- OpenAPI JSON: `http://localhost:3000/api/v1/swagger.json`

The document is titled `Agora API`, version `1.0`, and includes a Bearer auth scheme (`addBearerAuth`) plus `persistAuthorization` in the UI. That is OpenAPI wiring only. **Authentication is not implemented yet.**

## Logging

See [Request flow](request-flow.md) for when logs fire. Summary:

- `nestjs-pino` / Pino, logger name `nestjs-app`
- Pretty, colorized, single-line transport when `NODE_ENV` is not `production`; JSON in production
- `quietReqLogger: true` (no automatic per-request Pino HTTP line; status-based `customLogLevel` still applies to Pino’s HTTP logger)
- Paths in `SENSITIVE_LOG_PATHS` are redacted as `[REDACTED]`
- `RequestLogInterceptor` logs method, URL, body, query, params, and a small header subset at **debug** only

## Sample API

`AppController` `GET /` → `AppService.getHello()` → `'Hello World!'`. Replace this with a health check or first Agora domain module when the API surface is introduced.

## Redis coordination

`RedisModule` exports `RedisService`, which owns the single application Redis connection (`ioredis`, lazy connect on module init). Feature code must not open another command client. Socket.IO pub/sub duplicates are added in a later step.

Key names are built only in `src/redis/keys.ts` (`agora:queue`, `agora:presence:{clientId}`, `agora:pair:{smaller}:{larger}`, `agora:session:{sessionId}`, `agora:stats:public`, `agora:lock:sweeper`, `agora:rate:{scope}:{id}`).

`RedisService` methods used by matching, signaling, stats, and rate limits:

| Area          | Methods                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Queue         | `joinQueue` (Lua match script), `removeFromQueue`, `queueLength`, `listQueue`                                              |
| Presence      | `setPresence`, `setPresenceSessionId`, `refreshPresence`, `getPresence`, `deletePresenceIfSocket` (Lua compare-and-delete) |
| Pair block    | `setPairBlock` (`SET` with `NX`), `hasPairBlock`                                                                           |
| Session cache | `setSessionHash`, `getSessionHash`, `deleteSessionHash`                                                                    |
| Rate limit    | `rateLimit` (Lua `INCR` + window `EXPIRE`)                                                                                 |
| Stats cache   | `cacheStats`, `readStats`                                                                                                  |
| Sweeper       | `acquireSweeperLock`                                                                                                       |
| Adapter       | `duplicate()` for a second connection (Socket.IO adapter, step 6)                                                          |

TTLs for presence, pair block, and stats cache come from `ConfigService` (`PRESENCE_TTL_SECONDS`, `PAIR_BLOCK_TTL_SECONDS`, `STATS_CACHE_TTL_SECONDS`). The match script atomically pairs or enqueues; it checks pair blocks with `EXISTS` and never writes them.

## Product modules

| Concern                      | In this repo                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Auth (sessions, JWT, guards) | Not implemented yet. Swagger only declares Bearer.                            |
| Database / ORM               | Mongo connected (`DatabaseModule`). Session/review collections not added yet. |
| Redis (live coordination)    | Queue, presence, pair block, session hash, rate limit, stats cache (step 2).  |
| Users / profiles             | Not implemented yet.                                                          |
| Rooms / meetings             | Not implemented yet.                                                          |
| Participants / call sessions | Not implemented yet.                                                          |
| Media provider integration   | Not implemented yet.                                                          |
