import fs from 'node:fs/promises';
import { ConfigurationSchema } from '../src/configuration';

interface SchemaFlags {
    default?: unknown;
    presence?: string;
    description?: string;
}

interface SchemaKeyDescription {
    type?: string;
    flags?: SchemaFlags;
}

function isSchemaKeyDescription(value: unknown): value is SchemaKeyDescription {
    return typeof value === 'object' && value !== null;
}

function getSchemaKeys(description: unknown): Record<string, SchemaKeyDescription> {
    if (typeof description !== 'object' || description === null || !('keys' in description)) return {};

    const keys = (description as { keys?: unknown }).keys;
    if (typeof keys !== 'object' || keys === null) return {};

    return Object.fromEntries(Object.entries(keys).filter((entry): entry is [string, SchemaKeyDescription] => isSchemaKeyDescription(entry[1])));
}

function toEnvValue(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
    return JSON.stringify(value);
}

const environment = getSchemaKeys(ConfigurationSchema.describe());

let exampleEnv = '';
for (const [key, schema] of Object.entries(environment)) {
    const keyDefault = schema.flags?.default ?? '';
    const required = schema.flags?.presence ?? '';
    const description = schema.flags?.description ?? '';
    const keyType = schema.type ?? 'unknown';

    exampleEnv += `# ${keyType} ${required} ${description ? `[${description}]` : ''}\n`;
    exampleEnv += `${key}=${toEnvValue(keyDefault)}\n\n`;
}

fs.writeFile('example.env', exampleEnv, { encoding: 'utf8' }).catch((error: unknown) => {
    console.error('Failed to generate example.env', error);
    process.exitCode = 1;
});
