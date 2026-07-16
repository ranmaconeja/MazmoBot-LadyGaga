import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * Cola de canciones para el cliente de reproducción (el programa de Windows),
 * persistida en Turso. Reemplaza al WebSocket (PlayerService viejo): en vez de
 * que el servidor le avise al cliente en el momento ("push"), el cliente
 * pregunta cada tantos segundos si hay algo nuevo ("polling") contra
 * GET /player/next (ver PlayerController).
 *
 * Ventaja para Vercel: no hace falta ninguna conexión persistente, que las
 * funciones serverless no soportan.
 */
@Injectable()
export class PlayerQueueService {
    // si nadie pollea hace más de este tiempo, se asume que no hay cliente
    // conectado (el programa de Windows debería pollear cada 10-15seg)
    private readonly ACTIVE_WINDOW_MS = 60 * 1000;

    constructor(private readonly databaseService: DatabaseService) {
    }

    async enqueue(link: string, requestedBy: string): Promise<void> {
        const client = this.databaseService.getClient();
        await client.execute({
            sql: `INSERT INTO player_queue (link, requestedBy, createdAt, consumed) VALUES (?, ?, ?, 0)`,
            args: [link, requestedBy, new Date().toISOString()],
        });
    }

    /**
     * Devuelve la canción pendiente más vieja y la marca como consumida en el
     * mismo llamado (para que dos polls seguidos no reciban la misma canción dos veces).
     */
    async getNext(): Promise<{ link: string; requestedBy: string } | null> {
        const client = this.databaseService.getClient();
        const result = await client.execute(
            `SELECT id, link, requestedBy FROM player_queue WHERE consumed = 0 ORDER BY id ASC LIMIT 1`,
        );
        const row = result.rows[0] as unknown as { id: number; link: string; requestedBy: string } | undefined;
        if (!row) {
            return null;
        }

        await client.execute({
            sql: `UPDATE player_queue SET consumed = 1 WHERE id = ?`,
            args: [row.id],
        });

        return { link: row.link, requestedBy: row.requestedBy };
    }

    /**
     * Se llama cada vez que un cliente hace poll, para poder saber después si
     * "hay alguien escuchando" (ver hasActiveClient).
     */
    async registerPoll(): Promise<void> {
        const client = this.databaseService.getClient();
        const now = new Date().toISOString();
        await client.execute({
            sql: `
                INSERT INTO player_status (id, lastPollAt) VALUES (1, ?)
                ON CONFLICT(id) DO UPDATE SET lastPollAt = excluded.lastPollAt
            `,
            args: [now],
        });
    }

    /**
     * true si algún cliente hizo poll en los últimos ACTIVE_WINDOW_MS ms. Se usa
     * en !radio para avisar en el chat "no hay ningún reproductor conectado" en vez
     * de mandar la canción a una cola que nadie está mirando.
     */
    async hasActiveClient(): Promise<boolean> {
        const client = this.databaseService.getClient();
        const result = await client.execute(`SELECT lastPollAt FROM player_status WHERE id = 1`);
        const row = result.rows[0] as unknown as { lastPollAt: string } | undefined;

        if (!row || !row.lastPollAt) {
            return false;
        }

        return (Date.now() - new Date(row.lastPollAt).getTime()) < this.ACTIVE_WINDOW_MS;
    }
}
