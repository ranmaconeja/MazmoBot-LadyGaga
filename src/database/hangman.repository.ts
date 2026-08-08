import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

export type HangmanGame = {
    channelId: string,
    word: string,
    guessedLetters: string[],
    wrongLetters: string[],
    wrongCount: number,
    startedBy: string,
};

/**
 * Persiste el juego de !suspension activo por canal (uno por vez), y un
 * historial de palabras ya usadas para no repetirlas seguido.
 */
@Injectable()
export class HangmanRepository {
    constructor(private readonly databaseService: DatabaseService) {
    }

    async getActiveGame(channelId: string): Promise<HangmanGame | null> {
        const client = this.databaseService.getClient();
        const result = await client.execute({
            sql: 'SELECT * FROM hangman_game WHERE channelId = ?',
            args: [channelId],
        });
        const row = result.rows[0] as unknown as {
            channelId: string, word: string, guessedLetters: string, wrongLetters: string,
            wrongCount: number, startedBy: string,
        } | undefined;

        if (!row) {
            return null;
        }

        return {
            channelId: row.channelId,
            word: row.word,
            guessedLetters: row.guessedLetters ? row.guessedLetters.split(',') : [],
            wrongLetters: row.wrongLetters ? row.wrongLetters.split(',') : [],
            wrongCount: row.wrongCount,
            startedBy: row.startedBy,
        };
    }

    async createGame(channelId: string, word: string, startedBy: string): Promise<void> {
        const client = this.databaseService.getClient();
        const now = new Date().toISOString();
        await client.execute({
            sql: `
                INSERT INTO hangman_game (channelId, word, guessedLetters, wrongLetters, wrongCount, startedBy, startedAt)
                VALUES (?, ?, '', '', 0, ?, ?)
                ON CONFLICT(channelId) DO UPDATE SET
                    word = excluded.word, guessedLetters = '', wrongLetters = '',
                    wrongCount = 0, startedBy = excluded.startedBy, startedAt = excluded.startedAt
            `,
            args: [channelId, word, startedBy, now],
        });
        await client.execute({
            sql: 'INSERT INTO hangman_history (word, createdAt) VALUES (?, ?)',
            args: [word, now],
        });
    }

    async updateGame(channelId: string, guessedLetters: string[], wrongLetters: string[], wrongCount: number): Promise<void> {
        const client = this.databaseService.getClient();
        await client.execute({
            sql: 'UPDATE hangman_game SET guessedLetters = ?, wrongLetters = ?, wrongCount = ? WHERE channelId = ?',
            args: [guessedLetters.join(','), wrongLetters.join(','), wrongCount, channelId],
        });
    }

    async endGame(channelId: string): Promise<void> {
        const client = this.databaseService.getClient();
        await client.execute({
            sql: 'DELETE FROM hangman_game WHERE channelId = ?',
            args: [channelId],
        });
    }

    /**
     * Últimas `limit` palabras usadas, para no repetirlas al elegir una nueva.
     */
    async getRecentWords(limit: number = 15): Promise<string[]> {
        const client = this.databaseService.getClient();
        const result = await client.execute({
            sql: 'SELECT word FROM hangman_history ORDER BY id DESC LIMIT ?',
            args: [limit],
        });
        return result.rows.map(row => (row as unknown as { word: string }).word);
    }
}
