import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { TarotService } from '../modules/ai/tarot.service';
import { TarotRepository } from '../database/tarot.repository';
import { getArgentinaDateString } from '../util/argentina-date';

/**
 * Uso: !tarot (sin argumentos).
 * Tirada diaria por usuario: una carta de los Arcanos Mayores 0-X (desarrollo
 * interno) y otra del XI-XXI (proyección externa), cada una al derecho o al
 * revés. Las cartas y la orientación se eligen en código (no se le pide a la
 * IA que elija, para garantizar que respeta los dos grupos y que varía de
 * verdad) — la IA solo interpreta el significado.
 *
 * Se guarda una tirada por usuario por día (fecha calendario argentina): si
 * ya tiró hoy, se le repite la misma en vez de generar una nueva, hasta que
 * cambie la fecha a las 00hs.
 */
@Injectable()
export class TarotHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly tarotService: TarotService,
        private readonly tarotRepository: TarotRepository,
    ) {
    }

    getSignature(): string {
        return '!tarot';
    }

    async handleCommand(req: Request, res: Response, message: string): Promise<void> {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const authorId = String(body.message.author.id);
        const today = getArgentinaDateString();

        let reading = await this.tarotRepository.getForToday(authorId, today);

        if (!reading) {
            const { carta1, carta2 } = this.tarotService.pickCards();
            const interpretacion = await this.tarotService.interpretCards(carta1, carta2);

            if (!interpretacion) {
                await this.botService.sendReply(body.key, channelId, this.messagesService.get('TAROT_IA_ERROR'));
                return;
            }

            reading = {
                carta1: carta1.nombre,
                orientacion1: carta1.orientacion,
                significado1: interpretacion.significado1,
                carta2: carta2.nombre,
                orientacion2: carta2.orientacion,
                significado2: interpretacion.significado2,
            };
            await this.tarotRepository.save(authorId, today, reading);
        }

        const text = this.messagesService.get('TAROT_RESULT', {
            CARTA1: reading.carta1,
            ORIENTACION1: reading.orientacion1,
            SIGNIFICADO1: reading.significado1,
            CARTA2: reading.carta2,
            ORIENTACION2: reading.orientacion2,
            SIGNIFICADO2: reading.significado2,
        });
        await this.botService.sendReply(body.key, channelId, text);
    }
}
