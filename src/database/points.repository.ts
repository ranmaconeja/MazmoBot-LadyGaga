import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

const DAILY_ALLOWANCE = 20;
const RENEWAL_MS = 24 * 60 * 60 * 1000; // 24hs

@Injectable()
export class PointsRepository {
    constructor(private readonly databaseService: DatabaseService) {
    }

    /**
     * Se asegura de que el usuario exista en la tabla y esté al día con la renovación
     * diaria: si nunca se lo vio, arranca con DAILY_ALLOWANCE puntos; si ya pasaron
     * 24hs desde su último reseteo, se lo resetea a DAILY_ALLOWANCE de nuevo
     * (sin importar cuánto le quedaba).
     */
    private async ensureRenewed(userId: string): Promise<void> {
        const client = this.databaseService.getClient();
        const now = new Date();
        const nowIso = now.toISOString();

        const result = await client.execute({
            sql: 'SELECT lastRenewal FROM points WHERE userId = ?',
            args: [userId],
        });
        const row = result.rows[0] as unknown as { lastRenewal: string } | undefined;

        if (!row) {
            await client.execute({
                sql: `INSERT INTO points (userId, points, updatedAt, lastRenewal) VALUES (?, ?, ?, ?)`,
                args: [userId, DAILY_ALLOWANCE, nowIso, nowIso],
            });
            return;
        }

        const lastRenewal = row.lastRenewal ? new Date(row.lastRenewal) : null;
        const needsRenewal = !lastRenewal || (now.getTime() - lastRenewal.getTime() >= RENEWAL_MS);

        if (needsRenewal) {
            await client.execute({
                sql: `UPDATE points SET points = ?, updatedAt = ?, lastRenewal = ? WHERE userId = ?`,
                args: [DAILY_ALLOWANCE, nowIso, nowIso, userId],
            });
        }
    }

    async getPoints(userId: number | string): Promise<number> {
        const id = String(userId);
        await this.ensureRenewed(id);

        const client = this.databaseService.getClient();
        const result = await client.execute({
            sql: 'SELECT points FROM points WHERE userId = ?',
            args: [id],
        });
        const row = result.rows[0] as unknown as { points: number } | undefined;
        return row ? Number(row.points) : DAILY_ALLOWANCE;
    }

    /**
     * Suma una cantidad arbitraria de puntos (usado por !addPuntos), por encima
     * de lo que tenga en ese momento (ya renovado si correspondía).
     */
    async addPoints(userId: number | string, amount: number): Promise<number> {
        const id = String(userId);
        await this.ensureRenewed(id);

        const client = this.databaseService.getClient();
        const now = new Date().toISOString();

        await client.execute({
            sql: `UPDATE points SET points = points + ?, updatedAt = ? WHERE userId = ?`,
            args: [amount, now, id],
        });

        return this.getPoints(id);
    }

    /**
     * Descuenta `amount` puntos al usuario. Asume que ya se validó que tiene suficientes
     * (ver PointsService.canUseCommand) para evitar que el total quede negativo.
     */
    async spendPoints(userId: number | string, amount: number): Promise<number> {
        const id = String(userId);
        await this.ensureRenewed(id);

        const client = this.databaseService.getClient();
        const now = new Date().toISOString();

        await client.execute({
            sql: `UPDATE points SET points = MAX(points - ?, 0), updatedAt = ? WHERE userId = ?`,
            args: [amount, now, id],
        });

        return this.getPoints(id);
    }
}
