import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

export type TarotReading = {
    carta1: string,
    orientacion1: string,
    significado1: string,
    carta2: string,
    orientacion2: string,
    significado2: string,
};

/**
 * Guarda la tirada de !tarot de cada usuario, una por día (fecha calendario
 * argentina, ver util/argentina-date.ts) — si ya tiró hoy, se le repite la
 * misma en vez de generar una nueva.
 */
@Injectable()
export class TarotRepository {
    constructor(private readonly databaseService: DatabaseService) {
    }

    async getForToday(userId: string, date: string): Promise<TarotReading | null> {
        const client = this.databaseService.getClient();
        const result = await client.execute({
            sql: 'SELECT * FROM tarot_daily WHERE userId = ? AND date = ?',
            args: [userId, date],
        });
        const row = result.rows[0] as unknown as TarotReading | undefined;
        if (!row) {
            return null;
        }
        return {
            carta1: row.carta1,
            orientacion1: row.orientacion1,
            significado1: row.significado1,
            carta2: row.carta2,
            orientacion2: row.orientacion2,
            significado2: row.significado2,
        };
    }

    async save(userId: string, date: string, reading: TarotReading): Promise<void> {
        const client = this.databaseService.getClient();
        const now = new Date().toISOString();
        await client.execute({
            sql: `
                INSERT INTO tarot_daily (userId, date, carta1, orientacion1, significado1, carta2, orientacion2, significado2, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(userId, date) DO UPDATE SET
                    carta1 = excluded.carta1, orientacion1 = excluded.orientacion1, significado1 = excluded.significado1,
                    carta2 = excluded.carta2, orientacion2 = excluded.orientacion2, significado2 = excluded.significado2
            `,
            args: [userId, date, reading.carta1, reading.orientacion1, reading.significado1, reading.carta2, reading.orientacion2, reading.significado2, now],
        });
    }
}
