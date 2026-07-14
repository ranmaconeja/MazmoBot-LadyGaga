import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, Client } from '@libsql/client';

/**
 * Maneja la conexión a Turso (SQLite-compatible, alojado). Reemplaza a la base
 * SQLite en archivo local (better-sqlite3) porque en Vercel el filesystem es
 * efímero y no persiste entre invocaciones de la función serverless.
 *
 * Requiere dos variables de entorno:
 * - TURSO_DATABASE_URL: la URL de tu base (ej: libsql://tu-base-tuusuario.turso.io)
 * - TURSO_AUTH_TOKEN: el token de autenticación (se generan ambos desde el dashboard
 *   de Turso o con `turso db show` / `turso db tokens create`)
 */
@Injectable()
export class DatabaseService implements OnModuleInit {
    private readonly logger = new Logger('DatabaseService');
    private client: Client;

    async onModuleInit() {
        const url = process.env.TURSO_DATABASE_URL;
        const authToken = process.env.TURSO_AUTH_TOKEN;

        if (!url || !authToken) {
            this.logger.error('Faltan TURSO_DATABASE_URL y/o TURSO_AUTH_TOKEN en las variables de entorno: el sistema de puntos no va a funcionar.');
        }

        this.client = createClient({ url, authToken });

        // batch() manda las 3 sentencias en un solo round-trip a Turso, en vez de
        // esperar 3 respuestas secuenciales — achica la latencia de cada cold start
        await this.client.batch([
            `CREATE TABLE IF NOT EXISTS points (
                userId TEXT PRIMARY KEY,
                points INTEGER NOT NULL DEFAULT 0,
                updatedAt TEXT NOT NULL,
                lastRenewal TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS player_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                link TEXT NOT NULL,
                requestedBy TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                consumed INTEGER NOT NULL DEFAULT 0
            )`,
            `CREATE TABLE IF NOT EXISTS player_status (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                lastPollAt TEXT
            )`,
        ], 'write');
    }

    getClient(): Client {
        return this.client;
    }
}
