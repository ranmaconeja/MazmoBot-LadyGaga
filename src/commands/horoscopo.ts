import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
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

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const authorId = body.message.author.id;

        // saca comillas envolventes si el usuario las puso: "Piscis" -> Piscis
        const signo = message.trim().replace(/^"(.*)"$/, '$1').trim();

        if (!signo || signo.length > this.MAX_LENGTH) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('HOROSCOPO_USAGE'));
            return;
        }

        const user = await this.botService.getUserData(authorId);
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
