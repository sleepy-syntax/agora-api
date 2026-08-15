# Features

Why these pieces exist: a Nest backend you can clone, run, and extend without inventing the same HTTP/config/logging defaults each time. Auth and databases are omitted because those choices vary by project.

## HTTP adapter (Fastify)

`src/main.ts` creates `NestFastifyApplication` with `FastifyAdapter`. There is no Express adapter in this template. E2e tests use the same Fastify adapter (`test/app.e2e-spec.ts`).

Helmet is registered with `@fastify/helmet` using that plugin’s defaults (no extra options in this repo).

Shutdown hooks are enabled (`app.enableShutdownHooks()`).

## Global prefix

`app.setGlobalPrefix(GLOBAL_PREFIX)`. Default `api/v1`. All controller routes sit under that prefix.

## CORS

`app.enableCors({ origin: CLIENT_URL, credentials: true })`.

That is a **starter default**: one origin from `CLIENT_URL`. Change it for your app (several origins, a function, or CORS off). There is no extra CORS policy in this template.

## Request ID

Fastify is configured with:

- header name `X-Request-Id` (`REQUEST_ID_HEADER` in `src/constants/variables.ts`)
- `genReqId: () => randomUUID()` when the client does not send one

An `onRequest` hook copies `request.id` onto the response as `X-Request-Id`.

## Validation (Zod)

`app.useGlobalPipes(new ZodValidationPipe())` from `nestjs-zod`. DTOs that use Zod (when you add them) are validated globally. This template does not ship request DTOs yet.

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

The document is titled `API`, version `1.0`, and includes a Bearer auth scheme (`addBearerAuth`) plus `persistAuthorization` in the UI. That is OpenAPI wiring only. **This template does not implement authentication.**

## Logging

See [Request flow](request-flow.md) for when logs fire. Summary:

- `nestjs-pino` / Pino, logger name `nestjs-app`
- Pretty, colorized, single-line transport when `NODE_ENV` is not `production`; JSON in production
- `quietReqLogger: true` (no automatic per-request Pino HTTP line; status-based `customLogLevel` still applies to Pino’s HTTP logger)
- Paths in `SENSITIVE_LOG_PATHS` are redacted as `[REDACTED]`
- `RequestLogInterceptor` logs method, URL, body, query, params, and a small header subset at **debug** only

## Sample API

`AppController` `GET /` → `AppService.getHello()` → `'Hello World!'`. Replace this when you add real modules.

## Out of scope here

| Concern                      | In this repo                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Auth (sessions, JWT, guards) | No — left out because projects do not share one approach. Swagger only declares Bearer. |
| Database / ORM               | No — left out for the same reason.                                                      |
