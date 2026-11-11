import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

export type BanStat = {
    modId: string,
    username: string | null,
    count: number,
};

/**
 * Contador de bans por moderador (ranking de "Pejelagartos").
 *
 * - ban_stats: cuántos bans lleva cada mod.
 * - pending_bans: cuando un mod usa !ban, el ban lo ejecuta la organización,
 *   así que el webhook channel.ban puede llegar con la org como autora. Se
 *   anota acá quién lo pidió para atribuírselo a esa persona.
 * - ban_events: último ban procesado por usuario baneado, para ignorar los
 *   reintentos del mismo webhook (Mazmo reenvía si tardamos en contestar).
 */
@Injectable()
export class BanStatsRepository {
    // un !ban sin webhook en este tiempo se descarta
    private readonly PENDING_MAX_AGE_MS = 5 * 60 * 1000;
    // ventana para considerar un webhook de ban como repetido
    private readonly DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

    constructor(private readonly databaseService: DatabaseService) {
    }

    /** Suma 1 ban al mod y devuelve su total actualizado. */
    async increment(modId: string, username: string | null): Promise<number> {
        const client = this.databaseService.getClient();
        const now = new Date().toISOString();
        await client.execute({
            sql: `
                INSERT INTO ban_stats (modId, username, count, updatedAt)
                VALUES (?, ?, 1, ?)
                ON CONFLICT(modId) DO UPDATE SET
                    count = ban_stats.count + 1,
                    username = COALESCE(excluded.username, ban_stats.username),
                    updatedAt = excluded.updatedAt
            `,
            args: [modId, username, now],
        });
        const result = await client.execute({ sql: 'SELECT count FROM ban_stats WHERE modId = ?', args: [modId] });
        return Number((result.rows[0] as any)?.count ?? 1);
    }

    async getRanking(limit = 10): Promise<BanStat[]> {
        const client = this.databaseService.getClient();
        const result = await client.execute({
            sql: 'SELECT modId, username, count FROM ban_stats WHERE count > 0 ORDER BY count DESC, updatedAt ASC LIMIT ?',
            args: [limit],
        });
        return result.rows.map((row: any) => ({
            modId: String(row.modId),
            username: row.username ? String(row.username) : null,
            count: Number(row.count),
        }));
    }

    async savePending(bannedUserId: string, modId: string): Promise<void> {
        const client = this.databaseService.getClient();
        await client.execute({
            sql: `
                INSERT INTO pending_bans (bannedUserId, modId, createdAt) VALUES (?, ?, ?)
                ON CONFLICT(bannedUserId) DO UPDATE SET modId = excluded.modId, createdAt = excluded.createdAt
            `,
            args: [bannedUserId, modId, new Date().toISOString()],
        });
    }

    async deletePending(bannedUserId: string): Promise<void> {
        const client = this.databaseService.getClient();
        await client.execute({ sql: 'DELETE FROM pending_bans WHERE bannedUserId = ?', args: [bannedUserId] });
    }

    /** Devuelve (y borra) el mod que pidió el !ban de ese usuario, si es reciente. */
    async takePending(bannedUserId: string): Promise<string | null> {
        const client = this.databaseService.getClient();
        const result = await client.execute({
            sql: 'SELECT modId, createdAt FROM pending_bans WHERE bannedUserId = ?',
            args: [bannedUserId],
        });
        const row = result.rows[0] as any;
        if (!row) {
            return null;
        }
        await this.deletePending(bannedUserId);
        const age = Date.now() - new Date(String(row.createdAt)).getTime();
        return age <= this.PENDING_MAX_AGE_MS ? String(row.modId) : null;
    }

    /** Devuelve (y borra) el !ban pendiente más reciente, si tiene menos de 2 minutos. */
    async takeLatestPending(): Promise<{ bannedUserId: string, modId: string } | null> {
        const client = this.databaseService.getClient();
        const result = await client.execute('SELECT bannedUserId, modId, createdAt FROM pending_bans ORDER BY createdAt DESC LIMIT 1');
        const row = result.rows[0] as any;
        if (!row) {
            return null;
        }
        const age = Date.now() - new Date(String(row.createdAt)).getTime();
        if (age > 2 * 60 * 1000) {
            return null;
        }
        await this.deletePending(String(row.bannedUserId));
        return { bannedUserId: String(row.bannedUserId), modId: String(row.modId) };
    }

    /**
     * Marca el ban de ese usuario como procesado. Devuelve false si ya se
     * había procesado hace menos de DUPLICATE_WINDOW_MS (webhook repetido).
     */
    async markProcessed(bannedUserId: string): Promise<boolean> {
        const client = this.databaseService.getClient();
        const result = await client.execute({
            sql: 'SELECT processedAt FROM ban_events WHERE bannedUserId = ?',
            args: [bannedUserId],
        });
        const row = result.rows[0] as any;
        if (row && Date.now() - new Date(String(row.processedAt)).getTime() < this.DUPLICATE_WINDOW_MS) {
            return false;
        }
        await client.execute({
            sql: `
                INSERT INTO ban_events (bannedUserId, processedAt) VALUES (?, ?)
                ON CONFLICT(bannedUserId) DO UPDATE SET processedAt = excluded.processedAt
            `,
            args: [bannedUserId, new Date().toISOString()],
        });
        return true;
    }
}
