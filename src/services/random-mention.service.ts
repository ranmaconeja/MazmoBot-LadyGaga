import { Injectable, Logger } from '@nestjs/common';
import { RoomMessage } from '../types';
import { BotService } from './bot.service';

/**
 * Elige un participante al azar de la lista que manda Mazmo en
 * body.message.channel.participants. Usado por la detección pasiva de la
 * palabra "quien" (ver app.controller.ts).
 *
 * OJO: el nombre real del campo de ID dentro de cada participante nunca se
 * confirmó del todo contra un payload real (mismo problema que tuvo en su
 * momento !botellita) — se prueban varios nombres posibles como respaldo, y
 * se loguea el array crudo para poder ajustar con datos reales si hiciera
 * falta.
 */
@Injectable()
export class RandomMentionService {
    private readonly logger = new Logger('RandomMentionService');

    constructor(private readonly botService: BotService) {
    }

    private extractUserId(participant: any): number | null {
        const candidate = participant?.userId ?? participant?.id ?? participant?.user?.id ?? participant?.user_id ?? participant?.userID;
        const num = Number(candidate);
        return Number.isFinite(num) && num > 0 ? num : null;
    }

    /**
     * Devuelve el username de un participante al azar (o su ID como texto si
     * no se pudo resolver el username), o null si no se pudo extraer ningún
     * participante válido de la lista.
     */
    async pickRandomParticipant(body: RoomMessage): Promise<string | null> {
        const rawParticipants = (body.message.channel as any)?.participants ?? [];
        this.logger.debug(`"quien": ${rawParticipants.length} participantes crudos recibidos: ${JSON.stringify(rawParticipants)}`);

        const ids = rawParticipants
            .map((p: any) => this.extractUserId(p))
            .filter((id: number | null): id is number => id !== null);
        const uniqueIds: number[] = Array.from(new Set(ids));

        if (!uniqueIds.length) {
            this.logger.warn('"quien": no se pudo extraer ningún participante válido del canal');
            return null;
        }

        const randomId = uniqueIds[Math.floor(Math.random() * uniqueIds.length)];
        const user = await this.botService.getUserData(randomId);
        return user?.username ?? String(randomId);
    }
}
