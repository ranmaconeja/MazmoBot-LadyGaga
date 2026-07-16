import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Guarda un historial de los datos curiosos que ya devolvió !dato, para
 * pasárselos a la IA y que no repita siempre el mismo (sin esto, la IA tiende
 * a caer siempre en la referencia más obvia/común del tema — en la práctica,
 * el Marqués de Sade una y otra vez).
 */
@Injectable()
export class FactRepository {
    constructor(private readonly databaseService: DatabaseService) {
    }

    async save(fact: string): Promise<void> {
        const client = this.databaseService.getClient();
        const now = new Date().toISOString();
        await client.execute({
            sql: 'INSERT INTO dato_history (dato, createdAt) VALUES (?, ?)',
            args: [fact, now],
        });
    }

    /**
     * Devuelve los últimos `limit` datos usados (más recientes primero).
     */
    async getRecent(limit: number = 20): Promise<string[]> {
        const client = this.databaseService.getClient();
        const result = await client.execute({
            sql: 'SELECT dato FROM dato_history ORDER BY id DESC LIMIT ?',
            args: [limit],
        });
        return result.rows.map(row => (row as unknown as { dato: string }).dato);
    }
}
