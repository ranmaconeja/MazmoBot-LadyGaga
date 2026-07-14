import { Injectable } from '@nestjs/common';
import { PointsRepository } from '../database/points.repository';
import { ModeratorsService } from './moderators.service';

/**
 * Sistema anti-spam: cada usuario arranca con 20 puntos, que se renuevan
 * automáticamente a 20 (sin acumular) cada 24hs. Ejecutar un comando cuesta
 * COMMAND_COST puntos. Si no tiene suficientes, el comando no se ejecuta.
 * Moderadores y el owner del bot quedan excluidos: para ellos los comandos
 * son siempre gratis.
 *
 * Los puntos ahora se persisten en Turso (ver PointsRepository / DatabaseService),
 * por eso todos los métodos son async.
 */
@Injectable()
export class PointsService {
    private readonly COMMAND_COST = 5;

    constructor(
        private readonly pointsRepository: PointsRepository,
        private readonly moderatorsService: ModeratorsService,
    ) {
    }

    getCommandCost(): number {
        return this.COMMAND_COST;
    }

    /**
     * Mods y el owner del bot no participan del sistema de puntos: comandos gratis.
     */
    isExempt(userId: number | string): boolean {
        return this.moderatorsService.isModerator(userId);
    }

    async getPoints(userId: number | string): Promise<number> {
        return this.pointsRepository.getPoints(userId);
    }

    /**
     * Suma puntos manualmente a un usuario (usado por !sumarpuntos). No aplica ninguna
     * exención: se puede sumar puntos a cualquier usuario, sea o no moderador.
     */
    async addPointsManually(userId: number | string, amount: number): Promise<number> {
        return this.pointsRepository.addPoints(userId, amount);
    }

    /**
     * Chequea si el usuario tiene suficientes puntos para ejecutar un comando
     * (los exentos siempre pueden).
     */
    async canUseCommand(userId: number | string): Promise<boolean> {
        if (this.isExempt(userId)) {
            return true;
        }
        const points = await this.pointsRepository.getPoints(userId);
        return points >= this.COMMAND_COST;
    }

    /**
     * Descuenta el costo de un comando. No hace nada si el usuario está exento.
     * Llamar únicamente después de confirmar canUseCommand(userId) === true.
     */
    async spendCommandCost(userId: number | string): Promise<void> {
        if (this.isExempt(userId)) {
            return;
        }
        await this.pointsRepository.spendPoints(userId, this.COMMAND_COST);
    }
}
