import { Injectable } from '@nestjs/common';
import { PointsRepository } from '../database/points.repository';
import { ModeratorsService } from './moderators.service';

/**
 * Sistema anti-spam: cada usuario arranca con 20 puntos, y se le suman 5 más
 * por cada día que pasa (acumulables hasta un máximo de 100, no se resetean).
 * Ejecutar un comando cuesta COMMAND_COST puntos por defecto — algunos
 * comandos puntuales pueden tener un costo distinto (ver commandCosts). Si no
 * tiene suficientes, el comando no se ejecuta. Moderadores y el owner del bot
 * quedan excluidos: para ellos los comandos son siempre gratis.
 *
 * Los puntos ahora se persisten en Turso (ver PointsRepository / DatabaseService),
 * por eso todos los métodos son async.
 */
@Injectable()
export class PointsService {
    private readonly COMMAND_COST = 5;

    // costos especiales por comando (la clave tiene que ser el mismo string
    // en minúsculas y sin acentos que devuelve getSignature(), ej: !suspension
    // no !Suspensión) — cualquier comando que no esté acá usa COMMAND_COST
    private readonly commandCosts: { [key: string]: number } = {
        '!suspension': 50,
        '!tarot': 20,
    };

    constructor(
        private readonly pointsRepository: PointsRepository,
        private readonly moderatorsService: ModeratorsService,
    ) {
    }

    /**
     * Devuelve el costo de un comando puntual (o el costo por defecto si no
     * tiene uno especial, o si no se pasa ningún commandKey).
     */
    getCommandCost(commandKey?: string): number {
        if (commandKey && this.commandCosts[commandKey] !== undefined) {
            return this.commandCosts[commandKey];
        }
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
     * Suma puntos manualmente a un usuario (usado por !PuntosExtra). No aplica ninguna
     * exención: se puede sumar puntos a cualquier usuario, sea o no moderador.
     */
    async addPointsManually(userId: number | string, amount: number): Promise<number> {
        return this.pointsRepository.addPoints(userId, amount);
    }

    /**
     * Chequea si el usuario tiene suficientes puntos para ejecutar un comando
     * (los exentos siempre pueden).
     */
    async canUseCommand(userId: number | string, commandKey?: string): Promise<boolean> {
        if (this.isExempt(userId)) {
            return true;
        }
        const points = await this.pointsRepository.getPoints(userId);
        return points >= this.getCommandCost(commandKey);
    }

    /**
     * Descuenta el costo de un comando. No hace nada si el usuario está exento.
     * Llamar únicamente después de confirmar canUseCommand(userId) === true.
     */
    async spendCommandCost(userId: number | string, commandKey?: string): Promise<void> {
        if (this.isExempt(userId)) {
            return;
        }
        await this.pointsRepository.spendPoints(userId, this.getCommandCost(commandKey));
    }
}
