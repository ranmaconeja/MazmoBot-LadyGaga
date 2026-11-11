/**
 * Ayudas para leer el webhook channel.ban de Mazmo.
 *
 * 07/11/2026: el primer ban real mostró que channel.ban trae
 * payload.message (el cartel "X ha sido expulsado por Y"), pero la forma
 * exacta de ese mensaje todavía no se vio completa. Por eso, en vez de
 * adivinar rutas fijas, se recorre todo el payload buscando campos de ID.
 */

export type IdField = { path: string, key: string, value: string };

const ID_KEY = /(^id$|id$|Id$)/;

/** Junta todos los campos que parecen IDs de usuario, con su ruta. */
export function collectIdFields(obj: any, path = 'payload', out: IdField[] = [], depth = 0): IdField[] {
    if (!obj || typeof obj !== 'object' || depth > 6) {
        return out;
    }
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        const childPath = Array.isArray(obj) ? `${path}[${key}]` : `${path}.${key}`;
        if (value && typeof value === 'object') {
            collectIdFields(value, childPath, out, depth + 1);
        } else if (ID_KEY.test(key) && (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)))) {
            out.push({ path: childPath, key, value: String(value) });
        }
    }
    return out;
}

/** Una línea corta para el log: "payload.message.authorId=123, ...". */
export function describeIdFields(fields: IdField[]): string {
    return fields.map(f => `${f.path}=${f.value}`).join(', ') || '(ninguno)';
}

const BANNED_HINT = /banned(user)?(id)?$|target|victim|kicked|expelled/i;
const BANNER_HINT = /(by|actor|moderator|mod|admin|executor|banner|issuer|requester|operator)/i;

/**
 * Busca el usuario expulsado: primero campos con nombre explícito
 * (bannedUserId, target...), si no, el autor del mensaje del cartel
 * (que en Mazmo muestra la foto del expulsado).
 */
export function findBannedUserId(fields: IdField[], orgId?: string): string | undefined {
    const usable = fields.filter(f => f.value !== orgId);
    const explicit = usable.find(f => BANNED_HINT.test(f.path.split('.').slice(-2).join('.')) && !BANNER_HINT.test(f.key));
    if (explicit) {
        return explicit.value;
    }
    // con !ban el autor del cartel puede ser la propia organización: ese no es el expulsado
    const author = usable.find(f => /message\.(authorId|author\.id)$/.test(f.path));
    return author?.value;
}

/**
 * Busca el mod que expulsó: campos cuyo nombre (o el del objeto que los
 * contiene) indique "hecho por" (bannedBy, actor, moderator, ...),
 * descartando el expulsado y la propia organización.
 */
export function findBannerId(fields: IdField[], bannedUserId?: string, orgId?: string): string | undefined {
    const candidates = fields.filter(f =>
        f.value !== bannedUserId
        && !/channel/i.test(f.path)
        && BANNER_HINT.test(f.path.split('.').slice(-2).join('.')),
    );
    const human = candidates.find(f => f.value !== orgId);
    if (human ?? candidates[0]) {
        return (human ?? candidates[0]).value;
    }
    // si el expulsado vino en un campo explícito y el autor del cartel es
    // otra persona, el autor es quien expulsó
    const author = fields.find(f => /message\.(authorId|author\.id)$/.test(f.path));
    if (author && bannedUserId && author.value !== bannedUserId) {
        return author.value;
    }
    return undefined;
}
