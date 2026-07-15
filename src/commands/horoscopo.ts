import { CommandHandler, RoomMessage, UserData } from '../types';
import { Request, Response } from 'express';
import { Injectable, Logger } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { HoroscopeService } from '../modules/ai/horoscope.service';

/**
 * Uso: !horoscopo <signo> (las comillas son opcionales, ej: !horoscopo Piscis
 * o !horoscopo "Piscis" funcionan igual).
 * Le pide a la IA que confirme si es uno de los 12 signos del zodíaco; si lo
 * es, arma un horóscopo combinando el signo con las etiquetas del perfil de
 * quien ejecuta el comando. Si no es un signo válido, avisa el error.
 */
@Injectable()
export class HoroscopoHandler implements CommandHandler {
    private readonly logger = new Logger('HoroscopoHandler');

    // tope de largo del texto consultado, para no mandarle prompts gigantes a la IA
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
     * Busca el perfil de quien escribió el comando. Prueba primero
     * body.message.author.id (el campo que usa el resto del código), y si eso
     * no devuelve nada, prueba con body.message.authorId (un campo separado
     * que existe en el tipo pero que nunca se usó en ningún lado del proyecto
     * — no está confirmado cuál de los dos es el ID real que acepta la API de
     * Mazmo para /users/{id}, así que probamos los dos).
     */
    private async resolveSelf(body: RoomMessage): Promise<UserData | null> {
        const primaryId = body.message.author?.id;
        const fallbackId = (body.message as any)?.authorId;

        this.logger.debug(`!horoscopo: intentando resolver perfil propio. author.id=${primaryId}, authorId=${fallbackId}`);

        if (primaryId !== undefined && primaryId !== null) {
            const user = await this.botService.getUserData(primaryId);
            if (user) {
                return user;
            }
        }

        if (fallbackId !== undefined && fallbackId !== null && fallbackId !== primaryId) {
            this.logger.debug(`!horoscopo: author.id no encontró perfil, reintentando con authorId=${fallbackId}`);
            const user = await this.botService.getUserData(fallbackId);
            if (user) {
                this.logger.warn(`!horoscopo: authorId SÍ encontró el perfil pero author.id NO — conviene revisar cuál campo es el correcto en el resto del código.`);
                return user;
            }
        }

        this.logger.warn(`!horoscopo: no se pudo resolver el perfil propio con ningún campo de ID.`);
        return null;
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;

        // saca comillas envolventes si el usuario las puso: "Piscis" -> Piscis
        const signo = message.trim().replace(/^"(.*)"$/, '$1').trim();

        if (!signo || signo.length > this.MAX_LENGTH) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('HOROSCOPO_USAGE'));
            return;
        }

        const user = await this.resolveSelf(body);
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
