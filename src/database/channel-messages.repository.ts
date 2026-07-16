import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Log rotativo de los mensajes del canal (últimas 24hs), persistido en Turso.
 * Cada mensaje que llega por el webhook /message se guarda acá; los de más de
 * 24hs se borran de forma oportunista en cada insert (sin cron: Vercel Hobby
 * limita los cron jobs, y con el volumen del canal alcanza de sobra así).
 *
 * El guardado es "best effort": si falla, no debe romper el procesamiento
 * normal del mensaje (comandos, autofrases, etc.).
 */
@Injectable()
export class ChannelMessagesRepository {
    private readonly logger = new Logger('ChannelMessagesRepository');

    // retención del log: 24 horas
    private readonly RETENTION_MS = 24 * 60 * 60 * 1000;

    constructor(private readonly databaseService: DatabaseService) {
    }

    /**
     * Guarda un mensaje y aprovecha para borrar los vencidos (más de 24hs).
     * INSERT OR IGNORE: si Mazmo reintenta el webhook con el mismo mensaje,
     * no se duplica (la PK es el id del mensaje de Mazmo).
     */
    async save(messageId: string, authorId: number, content: string, createdAt: string): Promise<void> {
        try {
            const client = this.databaseService.getClient();
            const cutoff = new Date(Date.now() - this.RETENTION_MS).toISOString();
            await client.batch([
                {
                    sql: `INSERT OR IGNORE INTO channel_messages (id, authorId, content, createdAt) VALUES (?, ?, ?, ?)`,
                    args: [messageId, authorId, content, createdAt],
                },
                {
                    sql: `DELETE FROM channel_messages WHERE createdAt < ?`,
                    args: [cutoff],
                },
            ], 'write');
        } catch (e) {
            this.logger.warn(`No se pudo guardar el mensaje ${messageId} en el log del canal: ${e?.message}`);
        }
    }
}
