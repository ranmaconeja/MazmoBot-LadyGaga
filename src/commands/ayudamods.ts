import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { ModeratorsService } from '../services/moderators.service';

/**
 * Versión completa de !ayuda (incluye comandos de moderador/owner). Solo
 * responde si quien lo pide es moderador/owner; para cualquier otra persona
 * el bot no contesta nada (mismo patrón que !lazotest, no delata que existe).
 */
@Injectable()
export class AyudaModsHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly moderatorsService: ModeratorsService,
    ) {
    }

    getSignature(): string {
        return '!ayudamods';
    }

    async handleCommand(req: Request, res: Response, message: string): Promise<void> {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const authorId = body.message.author.id;

        const esModerador = this.moderatorsService.isModerator(authorId);
        if (!esModerador) {
            return;
        }

        const text = this.messagesService.get('AYUDA_MOD');
        await this.botService.sendReply(body.key, channelId, text);
    }
}
