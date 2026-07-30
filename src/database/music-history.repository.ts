import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

export type MusicHistoryEntry = {
    artist: string,
    title: string,
    suggestion: string,
};

/**
 * Guarda el historial de canciones sugeridas por !musica, para poder
 * cumplir dos reglas: no repetir un tema en los últimos 30 días, y no repetir
 * un artista más de 1 vez cada 10 pedidos.
 */
@Injectable()
export class MusicHistoryRepository {
    constructor(private readonly databaseService: DatabaseService) {
    }

    async save(entry: MusicHistoryEntry): Promise<void> {
        const client = this.databaseService.getClient();
        const now = new Date().toISOString();
        await client.execute({
            sql: 'INSERT INTO music_history (artist, title, suggestion, createdAt) VALUES (?, ?, ?, ?)',
            args: [entry.artist, entry.title, entry.suggestion, now],
        });
    }

    /**
     * Canciones sugeridas en los últimos `days` días (para no repetir tema).
     */
    async getRecentSongs(days: number = 30): Promise<string[]> {
        const client = this.databaseService.getClient();
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const result = await client.execute({
            sql: 'SELECT suggestion FROM music_history WHERE createdAt >= ? ORDER BY id DESC',
            args: [cutoff],
        });
        return result.rows.map(row => (row as unknown as { suggestion: string }).suggestion);
    }

    /**
     * Artistas de los últimos `count` pedidos (para no repetir artista más de
     * 1 vez cada 10 pedidos), más recientes primero.
     */
    async getRecentArtists(count: number = 10): Promise<string[]> {
        const client = this.databaseService.getClient();
        const result = await client.execute({
            sql: 'SELECT artist FROM music_history ORDER BY id DESC LIMIT ?',
            args: [count],
        });
        return result.rows.map(row => (row as unknown as { artist: string }).artist);
    }
}
