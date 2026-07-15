import { CommandHandler, RoomMessage, UserData } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';

/**
 * Uso: !botellita
 * Sortea dos participantes del canal para un mini juego de roles:
 * - Lado A: tiene que tener la etiqueta Switch o Dominante, y género femenino
 *   (FEMALE, WOMAN_CIS, FEMALE_TRANS o FEMALE_TRANSGENDER).
 * - Lado B: tiene que tener la etiqueta Switch o Sumiso/a, de cualquier género.
 * Ambos tienen que ser personas distintas.
 *
 * La lista de candidatos sale de body.message.channel.participants (que manda
 * Mazmo en cada webhook) — no hay forma de pedirle a la API "dame todos los
 * usuarios con tag X", así que se revisan perfiles al azar de a uno hasta
 * encontrar una combinación válida, en vez de pedir el perfil de TODO el canal
 * (que en un canal grande serían cientos de llamadas a la API de Mazmo).
 *
 * OJO: esto asume que Mazmo manda ahí la lista completa de participantes del
 * canal. Si en la práctica solo manda un subconjunto (ej: los últimos activos),
 * el sorteo solo va a poder elegir entre esos, no entre TODO el canal — convendría
 * confirmarlo probándolo en un canal real.
 */
@Injectable()
export class BotellitaHandler implements CommandHandler {
    // tope de perfiles a revisar antes de rendirse, para no demorar la función
    // ni quemar llamadas a la API en canales grandes donde nadie matchea
    private readonly MAX_ATTEMPTS = 40;

    private readonly ROLE_A_TAGS = new Set(['DOMINANT', 'SWITCH']);
    private readonly ROLE_A_GENDERS = new Set(['FEMALE', 'WOMAN_CIS', 'FEMALE_TRANS', 'FEMALE_TRANSGENDER']);
    private readonly ROLE_B_TAGS = new Set(['SWITCH', 'SUBMISIVE']);

    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
    ) {
    }

    getSignature(): string {
        return '!botellita';
    }

    private matchesRoleA(user: UserData): boolean {
        return this.ROLE_A_GENDERS.has(user.gender) && (user.tags ?? []).some(tag => this.ROLE_A_TAGS.has(tag));
    }

    private matchesRoleB(user: UserData): boolean {
        return (user.tags ?? []).some(tag => this.ROLE_B_TAGS.has(tag));
    }

    private shuffle<T>(items: T[]): T[] {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    /**
     * Arma una pareja válida (A y B distintos) eligiendo al azar dentro de cada
     * pool, en vez de quedarse siempre con el primero que matcheó.
     */
    private pickValidPair(poolA: UserData[], poolB: UserData[]): { userA: UserData, userB: UserData } | null {
        for (const userA of this.shuffle(poolA)) {
            const candidatesB = this.shuffle(poolB.filter(u => u.id !== userA.id));
            if (candidatesB.length) {
                return { userA, userB: candidatesB[0] };
            }
        }
        return null;
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;

        const participantIds = (body.message.channel.participants ?? []).map(p => p.userId);
        const uniqueIds = Array.from(new Set(participantIds));

        if (uniqueIds.length < 2) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('BOTELLITA_ERROR'));
            return;
        }

        const candidates = this.shuffle(uniqueIds).slice(0, this.MAX_ATTEMPTS);

        const poolA: UserData[] = [];
        const poolB: UserData[] = [];

        for (const userId of candidates) {
            const user = await this.botService.getUserData(userId);
            if (!user) {
                continue;
            }
            if (this.matchesRoleA(user)) {
                poolA.push(user);
            }
            if (this.matchesRoleB(user)) {
                poolB.push(user);
            }

            // corta apenas hay suficiente diversidad para armar una pareja
            // válida (2 personas distintas entre ambos pools)
            const distinctIds = new Set([...poolA, ...poolB].map(u => u.id));
            if (poolA.length && poolB.length && distinctIds.size >= 2) {
                break;
            }
        }

        const pair = this.pickValidPair(poolA, poolB);
        if (!pair) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('BOTELLITA_ERROR'));
            return;
        }

        const text = this.messagesService.get('BOTELLITA_RESULT', {
            USERNAME_A: pair.userA.username ?? String(pair.userA.id),
            USERNAME_B: pair.userB.username ?? String(pair.userB.id),
        });
        await this.botService.sendReply(body.key, channelId, text);
    }
}
