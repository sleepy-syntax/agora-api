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

## Product modules

| Concern                      | In this repo                                       |
| ---------------------------- | -------------------------------------------------- |
| Auth (sessions, JWT, guards) | Not implemented yet. Swagger only declares Bearer. |
| Database / ORM               | Not implemented yet.                               |
| Users / profiles             | Not implemented yet.                               |
| Rooms / meetings             | Not implemented yet.                               |
| Participants / call sessions | Not implemented yet.                               |
| Media provider integration   | Not implemented yet.                               |
