import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { PracticeService } from '../modules/ai/practice.service';

/**
 * Uso: !practica <nombre de la práctica> (las comillas son opcionales, ej:
 * !practica Pet Play o !practica "Pet Play" funcionan igual).
 * Le pide a la IA que evalúe si es una práctica BDSM reconocida: si lo es,
 * da una descripción breve; si no, avisa que no tiene nada que ver con el BDSM.
 */
@Injectable()
export class PracticaHandler implements CommandHandler {
    // tope de largo del texto consultado, para no mandarle prompts gigantes a la IA
    private readonly MAX_LENGTH = 200;

    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly practiceService: PracticeService,
    ) {
    }

    getSignature(): string {
        return '!practica';
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;

        // saca comillas envolventes si el usuario las puso: "Pet Play" -> Pet Play
        const practica = message.trim().replace(/^"(.*)"$/, '$1').trim();

        if (!practica) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('PRACTICA_USAGE'));
            return;
        }

        if (practica.length > this.MAX_LENGTH) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('PRACTICA_USAGE'));
            return;
        }

        const result = await this.practiceService.evaluate(practica);
        if (!result) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('PRACTICA_IA_ERROR'));
            return;
        }

        const text = this.messagesService.get('PRACTICA_RESULT', {
            DESCRIPCION: result.descripcion,
        });
        await this.botService.sendReply(body.key, channelId, text);
    }
}
