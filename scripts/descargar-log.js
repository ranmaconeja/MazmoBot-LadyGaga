/**
 * Descarga el log del canal (últimas 24hs de mensajes, tabla channel_messages
 * en Turso) a un archivo TXT legible en la raíz del proyecto.
 *
 * Uso (desde la raíz del proyecto):
 *   node scripts/descargar-log.js
 *
 * Lee las credenciales de Turso del .env (no se necesita nada más).
 * Los usernames se resuelven con la tabla known_users (el webhook de Mazmo solo
 * da el id numérico del autor); si un usuario nunca fue cacheado, se muestra el id.
 */

const fs = require('fs');
const path = require('path');

// carga el .env de la raíz del proyecto
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@libsql/client');

async function main() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
        console.error('Faltan TURSO_DATABASE_URL / TURSO_AUTH_TOKEN en el .env');
        process.exit(1);
    }

    const client = createClient({ url, authToken });

    // mensajes de las últimas 24hs, más viejos primero (orden de lectura natural)
    const result = await client.execute(
        `SELECT m.id, m.authorId, m.content, m.createdAt, k.username
         FROM channel_messages m
         LEFT JOIN known_users k ON k.id = m.authorId
         ORDER BY m.createdAt ASC`,
    );

    if (!result.rows.length) {
        console.log('El log está vacío (todavía no se capturó ningún mensaje, o pasaron más de 24hs sin actividad).');
        process.exit(0);
    }

    const lines = result.rows.map(row => {
        const fecha = new Date(row.createdAt);
        // hora argentina (UTC-3 fija, Argentina no tiene horario de verano)
        const argentina = new Date(fecha.getTime() - 3 * 60 * 60 * 1000);
        const hhmm = argentina.toISOString().replace('T', ' ').slice(0, 16);
        const quien = row.username ? `@${row.username}` : `[id:${row.authorId}]`;
        return `[${hhmm}] ${quien}: ${row.content}`;
    });

    const header = [
        `LOG DEL CANAL - últimas 24hs`,
        `Descargado: ${new Date().toISOString()} (UTC)`,
        `Mensajes: ${result.rows.length}`,
        `${'='.repeat(60)}`,
        '',
    ];

    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    const outPath = path.join(__dirname, '..', `channel-log-${stamp}.txt`);
    fs.writeFileSync(outPath, header.concat(lines).join('\r\n'), 'utf-8');
    console.log(`OK: ${result.rows.length} mensajes -> ${outPath}`);
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
