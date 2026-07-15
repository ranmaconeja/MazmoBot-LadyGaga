import { CommandHandler, RoomMessage, UserData } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { HoroscopeService } from '../modules/ai/horoscope.service';

/**
 * Uso: !horoscopo @usuario <signo> (acepta @menciones reales, IDs numéricos, o
 * usernames en texto plano para el usuario — mismo mecanismo que !lazo — y las
 * comillas en el signo son opcionales).
 *
 * Nota: antes este comando usaba el perfil de quien ejecutaba el comando
 * (resuelto por body.message.author.id), pero eso fallaba de forma consistente
 * en producción. En vez de seguir intentando diagnosticar ese campo, se cambió
 * a pedir el usuario explícitamente, usando el mismo mecanismo de resolución
 * (mención/ID/username) que ya funciona confirmado en !lazo, !astral y
 * !addPuntos.
 */
@Injectable()
export class HoroscopoHandler implements CommandHandler {
    // tope de largo del signo consultado, para no mandarle prompts gigantes a la IA
    private readonly MAX_LENGTH = 50;

    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly horoscopeService: HoroscopeService,
    ) {
    }

    getSignature(): string {
        return '!horoscopo';
    }

    /**
     * Extrae el identificador del usuario (mención real, ID numérico o
     * username en texto) y el signo de las palabras del mensaje. Igual
     * mecanismo que sumarpuntos.ts (ahora !addPuntos): si hay una mención
     * real, el signo es el último token del mensaje (no depende de cómo Mazmo
     * represente la mención en el texto plano); si no, el primer token es el
     * usuario y el resto es el signo.
     */
    private extractArgs(body: RoomMessage, message: string): { identifier: string, signo: string } {
        const parts = message.split(' ').map(part => part.trim()).filter(Boolean);
        const mentions = (body.message.payload as any)?.userMentions;

        if (Array.isArray(mentions) && mentions.length >= 1) {
            const id = mentions[0]?.id ?? mentions[0]?.userId ?? mentions[0]?.user?.id;
            if (id !== undefined && id !== null) {
                return { identifier: String(id), signo: parts[parts.length - 1] ?? '' };
            }
        }

        return { identifier: parts[0] ?? '', signo: parts.slice(1).join(' ') };
    }

    /**
     * Resuelve un identificador (ID numérico, @username o username sin @) a
     * los datos del usuario. Mismo patrón que compatibilidad.ts / perfil.ts.
     */
    private async resolveUser(identifier: string): Promise<UserData | null> {
        const cleanId = identifier.replace('@', '').trim();
        if (!cleanId) {
            return null;
        }
        if (!isNaN(Number(cleanId))) {
            return this.botService.getUserData(Number(cleanId));
        }
        return this.botService.getUserDataByUsername(cleanId);
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;

        const { identifier, signo: rawSigno } = this.extractArgs(body, message);
        // saca comillas envolventes si el usuario las puso: "Piscis" -> Piscis
        const signo = rawSigno.trim().replace(/^"(.*)"$/, '$1').trim();

        if (!identifier || !signo || signo.length > this.MAX_LENGTH) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('HOROSCOPO_USAGE'));
            return;
        }

        const user = await this.resolveUser(identifier);
        if (!user) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('HOROSCOPO_PERFIL_ERROR'));
            return;
        }

        const result = await this.horoscopeService.getHoroscope(signo, user);
        if (!result) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('HOROSCOPO_IA_ERROR'));
            return;
        }

        if (!result.esSignoValido) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('HOROSCOPO_SIGNO_INVALIDO'));
            return;
        }

        const text = this.messagesService.get('HOROSCOPO_RESULT', {
            SIGNO: signo,
            HOROSCOPO: result.horoscopo,
        });
        await this.botService.sendReply(body.key, channelId, text);
    }
}
