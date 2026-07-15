import { Injectable } from '@nestjs/common';
import { CooldownRepository } from '../database/cooldown.repository';

/**
 * Identificador fijo para usar en vez de un userId real cuando el cooldown
 * tiene que ser GLOBAL (compartido por todo el canal) en vez de por usuario:
 * todos comparten la misma fila en la tabla, así que si cualquiera usa el
 * comando, se resetea el cooldown para todos los demás también.
 */
export const GLOBAL_COOLDOWN_KEY = '__global__';

/**
 * Límite de uso genérico por usuario+comando (independiente del sistema de
 * puntos). Usado por !reglas y !filosofia para que, entre todos los usuarios
 * comunes del canal, no se pueda repetir el comando más de una vez cada tantas
 * horas (cooldown global, no por persona — ver GLOBAL_COOLDOWN_KEY arriba).
 */
@Injectable()
export class CooldownService {
    constructor(private readonly cooldownRepository: CooldownRepository) {
    }

    /**
     * Si el usuario puede usar el comando ahora, lo marca como usado y
     * devuelve `null`. Si todavía está en cooldown, NO lo marca y devuelve
     * los minutos que le faltan para poder usarlo de nuevo.
     */
    async checkAndMark(userId: number | string, command: string, cooldownMs: number): Promise<number | null> {
        const id = String(userId);
        const lastUsed = await this.cooldownRepository.getLastUsed(id, command);

        if (lastUsed) {
            const elapsedMs = Date.now() - lastUsed.getTime();
            if (elapsedMs < cooldownMs) {
                return Math.ceil((cooldownMs - elapsedMs) / (60 * 1000));
            }
        }

        await this.cooldownRepository.markUsed(id, command);
        return null;
    }
}
