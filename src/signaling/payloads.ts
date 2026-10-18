import { z } from 'zod';
import type { Socket } from 'socket.io';
import { ERROR_CODES, ERROR_MESSAGES, SERVER_EVENTS, type IErrorPayload } from './events';

export const emptyPayloadSchema = z.strictObject({});

export type TEmptyPayload = z.infer<typeof emptyPayloadSchema>;

const sessionIdSchema = z.uuid();

const sdpPartSchema = z.object({ sdp: z.string() });

export function signalOfferSchema() {
    return z.object({
        sessionId: sessionIdSchema,
        sdp: sdpPartSchema.extend({ type: z.literal('offer') }),
    });
}

export function signalAnswerSchema() {
    return z.object({
        sessionId: sessionIdSchema,
        sdp: sdpPartSchema.extend({ type: z.literal('answer') }),
    });
}

export const signalIceSchema = z.object({
    sessionId: sessionIdSchema,
    candidate: z.union([z.null(), z.record(z.string(), z.unknown())]),
});

export const mediaStateSchema = z.object({
    sessionId: sessionIdSchema,
    cameraEnabled: z.boolean(),
    micEnabled: z.boolean(),
});

export const sessionIdPayloadSchema = z.object({
    sessionId: sessionIdSchema,
});

export type TSignalOfferPayload = z.infer<ReturnType<typeof signalOfferSchema>>;
export type TSignalAnswerPayload = z.infer<ReturnType<typeof signalAnswerSchema>>;
export type TSignalIcePayload = z.infer<typeof signalIceSchema>;
export type TMediaStatePayload = z.infer<typeof mediaStateSchema>;
export type TSessionIdPayload = z.infer<typeof sessionIdPayloadSchema>;

export function readPayload<T>(socket: Socket, schema: z.ZodType<T>, raw: unknown): T | null {
    const parsed = schema.safeParse(raw ?? {});
    if (parsed.success) return parsed.data;

    const payload: IErrorPayload = {
        code: ERROR_CODES.invalidPayload,
        message: ERROR_MESSAGES[ERROR_CODES.invalidPayload],
    };

    socket.emit(SERVER_EVENTS.error, payload);
    return null;
}
