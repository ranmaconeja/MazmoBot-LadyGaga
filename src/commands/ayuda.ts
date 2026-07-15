import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { ModeratorsService } from '../services/moderators.service';

@Injectable()
export class AyudaHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly moderatorsService: ModeratorsService,
    ) {
    }

    getSignature(): string {
        return '!ayuda';
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const authorId = body.message.author.id;
        const isMod = this.moderatorsService.isModerator(authorId);

        if (isMod) {
            // la lista completa (incluye comandos de moderador) se manda solo
            // por privado a quien la pidió, nunca se publica en el canal
            const text = this.messagesService.get('AYUDA_MOD');
            await this.botService.notifyUser(body.key, channelId, authorId, text);
            return;
        }

        const text = this.messagesService.get('AYUDA');
        await this.botService.sendReply(body.key, channelId, text);
    }
}
