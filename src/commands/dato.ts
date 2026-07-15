import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { FactService } from '../modules/ai/fact.service';

/**
 * Uso: !dato (sin argumentos).
 * Le pide a la IA un dato curioso sobre el mundo Femdom/BDSM: histórico,
 * cultural, o sobre alguna figura pública (con el resguardo de solo mencionar
 * información ya pública y verificable, ver fact.service.ts).
 */
@Injectable()
export class DatoHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly factService: FactService,
    ) {
    }

    getSignature(): string {
        return '!dato';
    }

    async handleCommand(req: Request, res: Response, message: string): Promise<void> {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;

        const fact = await this.factService.getFact();
        if (!fact) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('DATO_IA_ERROR'));
            return;
        }

        const text = this.messagesService.get('DATO_RESULT', { DATO: fact });
        await this.botService.sendReply(body.key, channelId, text);
    }
}
