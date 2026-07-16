import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';

/**
 * Lista corta de comandos, igual para cualquier usuario. Se manda por privado
 * (solo lo ve quien lo pidió), no al canal completo.
 * La versión completa para moderadores/owner es un comando aparte: !ayudaMods.
 */
@Injectable()
export class AyudaHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
    ) {
    }

    getSignature(): string {
        return '!ayuda';
    }

    async handleCommand(req: Request, res: Response, message: string): Promise<void> {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const text = this.messagesService.get('AYUDA');
        await this.botService.notifyUser(body.key, channelId, body.message.author.id, text);
    }
}
