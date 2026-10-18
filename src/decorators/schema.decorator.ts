import { SchemaOptions, Schema as MongooseSchema } from '@nestjs/mongoose';

function withStringId(_doc: unknown, ret: { _id?: unknown; id?: string }) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
}

export function Schema(schemaOptions: SchemaOptions = {}): ClassDecorator {
    return MongooseSchema({
        id: true,
        timestamps: true,
        toJSON: { virtuals: true, versionKey: false, transform: withStringId },
        toObject: { virtuals: true, versionKey: false, transform: withStringId },

        ...schemaOptions,
    });
}
