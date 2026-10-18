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

### Reviews

`POST /api/v1/reviews` (see [Reviews](features.md#reviews-mongo)):

```text
Client
  → Fastify / global prefix
  → ZodValidationPipe (rating 1–5, optional comment string)
  → ReviewsController (review IP rate limit, then ReviewsService.create)
  → Mongo insert
  → 201 { id, rating, comment, createdAt }
```

Invalid rating values and a comment longer than 1000 characters fail in the pipe with `errors`. The service only trims a comment that already passed that check. Rate limit failure is `429` before Mongo.

## Socket.IO (signaling)

Path is `SOCKET_PATH` (default `/socket.io`) on the same host and port as HTTP. Not prefixed with `api/v1`.

```text
Client (auth.userId on handshake)
  → Socket.IO middleware (parseUserId)
  → handleConnection (presence, replace older socket)
  → SubscribeMessage handlers (readPayload → refreshPresence → service)
  → server.to(socketId).emit / Redis adapter cross-process
```

Handshake failure uses connection error `invalid_user_id`. Inbound handler failures emit `error` with `{ code, message }` (for example `invalid_payload`, `rate_limited`, `already_in_session`, `not_a_participant`, `session_ended`). The global Zod pipe does not validate socket message bodies; the gateway uses `readPayload` and refreshes presence on accepted messages.

After `queue.join` returns a partner, `SignalingService.onMatched` creates the session, updates presence, joins Socket.IO rooms, and emits `session.matched`. Signal and media events relay to room `session:{sessionId}` excluding the sender. `media.connected` is the only path that writes the one-hour pair block.

`SessionSweeper` (five-second interval, Redis sweeper lock) prunes stale queue entries and ends sessions that time out or lose participant presence; survivors receive `session.ended` with `next: "waiting"` and are passed back through `MatchingService.join`.

`session.end` and `session.next` run the same finish path: End sends the presser to rating (`next: "rating"`) and requeues the partner; Change partner requeues both.

Disconnect runs `deletePresenceIfSocket` so a replaced tab’s teardown does not clear the new socket’s presence, then `SignalingService.onDisconnect` ends the session for the remaining participant. Application shutdown ends local open sessions the same way.
