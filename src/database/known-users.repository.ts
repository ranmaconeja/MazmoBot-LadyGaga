import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Caché id->username de usuarios de Mazmo. Ver comentario en el CREATE TABLE
 * de database.service.ts: GET /users/{id} no funciona de forma confiable,
 * solo GET /users/{username} — este caché es el respaldo para cuando solo
 * tenemos el id numérico (ej: el autor de un mensaje en !radio).
 */
@Injectable()
export class KnownUsersRepository {
    private readonly logger = new Logger('KnownUsersRepository');

    constructor(private readonly databaseService: DatabaseService) {
    }

    async upsert(id: number, username: string): Promise<void> {
        try {
            const client = this.databaseService.getClient();
            await client.execute({
                sql: `
                    INSERT INTO known_users (id, username, updatedAt) VALUES (?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET username = excluded.username, updatedAt = excluded.updatedAt
                `,
                args: [id, username, new Date().toISOString()],
            });
        } catch (e) {
            // no queremos que un problema de caché rompa una resolución de usuario que ya funcionó
            this.logger.warn(`No se pudo cachear id=${id} username=${username}: ${e?.message}`);
        }
    }

    async getUsername(id: number): Promise<string | null> {
        try {
            const client = this.databaseService.getClient();
            const result = await client.execute({
                sql: 'SELECT username FROM known_users WHERE id = ?',
                args: [id],
            });
            const row = result.rows[0] as unknown as { username: string } | undefined;
            return row?.username ?? null;
        } catch (e) {
            this.logger.warn(`No se pudo leer el cache para id=${id}: ${e?.message}`);
            return null;
        }
    }
}
