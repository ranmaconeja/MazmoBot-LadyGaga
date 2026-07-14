/**
 * Mazmo envuelve el texto de los mensajes en tags HTML (ej: "<p>!ping</p>"),
 * así que hay que limpiarlo antes de buscar comandos, palabras clave o links,
 * o nunca van a coincidir con nada.
 */
export function stripHtml(rawContent: string): string {
    if (!rawContent) {
        return '';
    }

    return rawContent
        // saltos de párrafo/línea se convierten en espacio, para no pegar palabras de renglones distintos
        .replace(/<\/p>\s*<p>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        // se quita cualquier otro tag HTML restante
        .replace(/<[^>]*>/g, '')
        // entidades HTML más comunes
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
}
