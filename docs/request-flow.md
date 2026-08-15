# Request flow

Bootstrap (`src/main.ts`):

1. Load `.env` via `dotenv/config`.
2. Create Fastify adapter (request IDs).
3. Create the Nest app with `bufferLogs` / `autoFlushLogs`.
4. Use Pino as the Nest logger.
5. Set global prefix, Helmet, CORS, exception filter, shutdown hooks, Zod pipe.
6. Optionally mount Swagger.
7. `listen` on `PORT` at `0.0.0.0`.

`AppModule` imports `NestLoggerModule` and `ConfigModule`, registers `AppController` / `AppService`, and binds `RequestLogInterceptor` as `APP_INTERCEPTOR`.

## Incoming HTTP

```text
Client
  → Fastify (assign/echo X-Request-Id, Helmet)
  → Nest global prefix
  → CORS
  → Pino HTTP logger (quietReqLogger; level from status / error)
  → RequestLogInterceptor (debug only)
  → ZodValidationPipe
  → Controller / provider
  → GlobalExceptionFilter if something is thrown
  → Response
```

### Request ID

If the client sends `X-Request-Id`, Fastify uses it as `request.id`. Otherwise it generates a UUID. The same value is set on the response header.

### RequestLogInterceptor

Runs only for HTTP and only if the Pino level allows `debug`. It logs:

- `ip`, `method`, `originalUrl`, `path` (URL without query), `route` (`request.routeOptions.url`), `hostname`, `protocol`
- `body`, `query`, `params`
- headers: `host`, `content-type`, `content-length`, `user-agent`, `referer`, `x-forwarded-for`

Authorization and cookie headers are not copied into this object. Body/query secrets still rely on Pino `redact` paths in `SENSITIVE_LOG_PATHS` (for example `request.body.password`, `request.body.accessToken`). Add paths there when you add new secret fields.

### After the handler

Success: the controller return value is sent as usual.

Failure: `GlobalExceptionFilter` sends `{ statusCode, message, errors? }` as described in [Features](features.md#errors).
