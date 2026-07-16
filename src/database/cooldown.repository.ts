import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Guarda cuándo fue la última vez que cada usuario usó un comando con límite
 * de uso (ej: !reglas, !filosofia). Una fila por combinación usuario+comando.
 */
@Injectable()
export class CooldownRepository {
    constructor(private readonly databaseService: DatabaseService) {
    }

    async getLastUsed(userId: string, command: string): Promise<Date | null> {
        const client = this.databaseService.getClient();
        const result = await client.execute({
            sql: 'SELECT lastUsedAt FROM command_cooldowns WHERE userId = ? AND command = ?',
            args: [userId, command],
        });
        const row = result.rows[0] as unknown as { lastUsedAt: string } | undefined;
        return row ? new Date(row.lastUsedAt) : null;
    }

    async markUsed(userId: string, command: string): Promise<void> {
        const client = this.databaseService.getClient();
        const now = new Date().toISOString();
        await client.execute({
            sql: `
                INSERT INTO command_cooldowns (userId, command, lastUsedAt) VALUES (?, ?, ?)
                ON CONFLICT(userId, command) DO UPDATE SET lastUsedAt = excluded.lastUsedAt
            `,
            args: [userId, command, now],
        });
    }
}
