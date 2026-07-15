import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

const STARTING_POINTS = 20;
const DAILY_BONUS = 5;
const MAX_POINTS = 100;
const RENEWAL_MS = 24 * 60 * 60 * 1000; // 24hs

@Injectable()
export class PointsRepository {
    constructor(private readonly databaseService: DatabaseService) {
    }

    /**
     * Se asegura de que el usuario exista en la tabla y esté al día con el bono
     * diario: si nunca se lo vio, arranca con STARTING_POINTS puntos; si ya
     * pasó un día (o más) desde su último acreditado, se le suman DAILY_BONUS
     * puntos por cada día completo transcurrido, ACUMULÁNDOSE sobre lo que ya
     * tenía (antes se reseteaba a un valor fijo, perdiendo lo acumulado) — pero
     * sin pasar nunca de MAX_POINTS. Este tope solo aplica a la renovación
     * automática; !PuntosExtra (suma manual de un moderador) sí puede llevar a
     * alguien por encima de MAX_POINTS a propósito.
     *
     * lastRenewal avanza exactamente la cantidad de días acreditados (no se
     * resetea a "ahora"), para no perder el progreso del día en curso ni
     * permitir "adelantar el reloj" usando el bot justo antes de medianoche.
     */
    private async ensureRenewed(userId: string): Promise<void> {
        const client = this.databaseService.getClient();
        const now = new Date();
        const nowIso = now.toISOString();

        const result = await client.execute({
            sql: 'SELECT points, lastRenewal FROM points WHERE userId = ?',
            args: [userId],
        });
        const row = result.rows[0] as unknown as { points: number, lastRenewal: string } | undefined;

        if (!row) {
            await client.execute({
                sql: `INSERT INTO points (userId, points, updatedAt, lastRenewal) VALUES (?, ?, ?, ?)`,
                args: [userId, STARTING_POINTS, nowIso, nowIso],
            });
            return;
        }

        const lastRenewal = row.lastRenewal ? new Date(row.lastRenewal) : now;
        const daysElapsed = Math.floor((now.getTime() - lastRenewal.getTime()) / RENEWAL_MS);

        if (daysElapsed >= 1) {
            const bonus = daysElapsed * DAILY_BONUS;
            const newLastRenewal = new Date(lastRenewal.getTime() + daysElapsed * RENEWAL_MS);
            await client.execute({
                sql: `UPDATE points SET points = MIN(points + ?, ?), updatedAt = ?, lastRenewal = ? WHERE userId = ?`,
                args: [bonus, MAX_POINTS, nowIso, newLastRenewal.toISOString(), userId],
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
        return row ? Number(row.points) : STARTING_POINTS;
    }

    /**
     * Suma una cantidad arbitraria de puntos (usado por !PuntosExtra), por encima
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
