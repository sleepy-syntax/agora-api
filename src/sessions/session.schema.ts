import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TEndReason = 'change_partner' | 'user_end' | 'disconnect' | 'connect_failed';

export type TEndSession =
    | { endReason: 'change_partner'; endedBy: string }
    | { endReason: 'user_end'; endedBy: string }
    | { endReason: 'disconnect'; endedBy: string }
    | { endReason: 'connect_failed'; endedBy: null };

export interface ISession {
    _id: string;
    participants: [string, string];
    offererId: string;
    matchedAt: Date;
    connectedAt: Date | null;
    endedAt: Date | null;
    endReason: TEndReason | null;
    endedBy: string | null;
    durationMs: number | null;
}

export type SessionDocument = HydratedDocument<Session>;

@Schema({ collection: 'sessions', timestamps: false, versionKey: false, id: false })
export class Session implements ISession {
    @Prop({ type: String, required: true })
    _id!: string;

    @Prop({ type: [String], required: true })
    participants!: [string, string];

    @Prop({ type: String, required: true })
    offererId!: string;

    @Prop({ type: Date, required: true })
    matchedAt!: Date;

    @Prop({ type: Date, default: null })
    connectedAt!: Date | null;

    @Prop({ type: Date, default: null })
    endedAt!: Date | null;

    @Prop({ type: String, default: null })
    endReason!: TEndReason | null;

    @Prop({ type: String, default: null })
    endedBy!: string | null;

    @Prop({ type: Number, default: null })
    durationMs!: number | null;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

SessionSchema.index({ matchedAt: -1 });
SessionSchema.index({ endedAt: 1, matchedAt: 1 });
SessionSchema.index({ endedAt: 1, connectedAt: 1 });
SessionSchema.index({ participants: 1, matchedAt: -1 });
