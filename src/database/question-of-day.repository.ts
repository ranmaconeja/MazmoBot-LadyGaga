import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Guarda/recupera la "pregunta del día" por fecha (formato YYYY-MM-DD, ver
 * util/argentina-date.ts). Una sola fila por día: si ya existe una pregunta
 * para hoy, se reutiliza tal cual; recién se genera una nueva cuando cambia
 * la fecha. Usado por !dia.
 */
@Injectable()
export class QuestionOfDayRepository {
    constructor(private readonly databaseService: DatabaseService) {
    }

    async getForDate(date: string): Promise<string | null> {
        const client = this.databaseService.getClient();
        const result = await client.execute({
            sql: 'SELECT question FROM question_of_day WHERE date = ?',
            args: [date],
        });
        const row = result.rows[0] as unknown as { question: string } | undefined;
        return row?.question ?? null;
    }

    /**
     * Devuelve las últimas `limit` preguntas usadas (de cualquier fecha), para
     * pasárselas a la IA y que no repita ninguna al generar una nueva.
     */
    async getRecentQuestions(limit: number = 30): Promise<string[]> {
        const client = this.databaseService.getClient();
        const result = await client.execute({
            sql: 'SELECT question FROM question_of_day ORDER BY date DESC LIMIT ?',
            args: [limit],
        });
        return result.rows.map(row => (row as unknown as { question: string }).question);
    }

    /**
     * Guarda la pregunta para una fecha. Usa ON CONFLICT en vez de asumir que
     * la fila no existe, por si dos personas dispararon !dia casi al mismo
     * tiempo justo cuando cambió el día — en ese caso rarísimo, gana la
     * última que se guarda, y a partir de ahí todos ven la misma.
     */
    async save(date: string, question: string): Promise<void> {
        const client = this.databaseService.getClient();
        const now = new Date().toISOString();
        await client.execute({
            sql: `
                INSERT INTO question_of_day (date, question, createdAt) VALUES (?, ?, ?)
                ON CONFLICT(date) DO UPDATE SET question = excluded.question
            `,
            args: [date, question, now],
        });
    }
}
