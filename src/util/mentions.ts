/**
 * Mazmo representa las @menciones dentro del HTML del rawContent, con una
 * etiqueta custom <mazmo-user>, NO en el array userMentions del payload (que
 * confirmado el 16/07/2026 con logs reales viene siempre vacío []).
 *
 * Ejemplo de rawContent real:
 *   <p>!lazo <mazmo-user username="ranma" displayname="Ranma Coneja">@ranma</mazmo-user>
 *   <mazmo-user username="femdombot" displayname="Femdom Bunny">@femdombot</mazmo-user> </p>
 *
 * Cada mención trae el username Y el displayname directo en el mensaje, así que
 * NO hace falta llamar a la API de Mazmo para resolver el nombre de un usuario
 * mencionado — un dato clave, porque GET /users/{id} por id numérico no funciona
 * de forma confiable (ver bot.service.ts).
 */

export type ParsedMention = {
    username: string,
    displayname: string,
};

/**
 * Extrae todas las menciones <mazmo-user> del rawContent crudo (con HTML),
 * en el orden en que aparecen. Devuelve [] si no hay ninguna.
 *
 * IMPORTANTE: pasar el rawContent CRUDO (body.message.payload.rawContent),
 * NO el resultado de stripHtml() — stripHtml borra la etiqueta y con ella los
 * atributos username/displayname.
 */
export function parseMentions(rawContent: string): ParsedMention[] {
    if (!rawContent) {
        return [];
    }

    const mentions: ParsedMention[] = [];
    // captura cada <mazmo-user ...> con sus atributos; los atributos pueden venir
    // en cualquier orden, así que se buscan por separado dentro de cada tag
    const tagRegex = /<mazmo-user\b([^>]*)>/gi;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(rawContent)) !== null) {
        const attrs = match[1];
        const username = extractAttr(attrs, 'username');
        const displayname = extractAttr(attrs, 'displayname');
        if (username || displayname) {
            mentions.push({
                username: username ?? '',
                displayname: displayname ?? '',
            });
        }
    }
    return mentions;
}

function extractAttr(attrs: string, name: string): string | null {
    const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i');
    const m = attrs.match(re);
    return m ? decodeHtmlEntities(m[1]) : null;
}

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}
