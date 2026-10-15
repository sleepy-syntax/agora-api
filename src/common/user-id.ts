const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function parseUserId(value: unknown): string | null {
    if (typeof value !== 'string') return null;

    const id = value.trim().toLowerCase();
    return USER_ID.test(id) ? id : null;
}
