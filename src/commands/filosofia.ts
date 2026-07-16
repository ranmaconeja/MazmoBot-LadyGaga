import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { ModeratorsService } from '../services/moderators.service';
import { CooldownService, GLOBAL_COOLDOWN_KEY } from '../services/cooldown.service';

const COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 horas

/**
 * Cooldown GLOBAL (compartido por todo el canal, no por persona): máximo 1 uso
 * cada 3 horas entre TODOS los usuarios comunes — si Pepito lo usa, Jorgito
 * tiene que esperar el mismo cooldown, aunque nunca lo haya usado él. La
 * respuesta llega solo por privado a quien lo pidió. Moderadores/owner no
 * tienen límite de uso, y si lo piden ellos, la respuesta se publica en el
 * canal en vez de en privado.
 */
@Injectable()
export class FilosofiaHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly moderatorsService: ModeratorsService,
        private readonly cooldownService: CooldownService,
    ) {
    }

    getSignature(): string {
        return '!filosofia';
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const authorId = body.message.author.id;
        const isMod = this.moderatorsService.isModerator(authorId);

        if (!isMod) {
            const minutosRestantes = await this.cooldownService.checkAndMark(GLOBAL_COOLDOWN_KEY, '!filosofia', COOLDOWN_MS);
            if (minutosRestantes !== null) {
                const text = this.messagesService.get('COOLDOWN_ERROR', { MINUTOS: String(minutosRestantes) });
                await this.botService.notifyUser(body.key, channelId, authorId, text);
                return;
            }
        }

        const text = this.messagesService.get('FILOSOFIA');
        if (isMod) {
            await this.botService.sendReply(body.key, channelId, text);
        } else {
            await this.botService.notifyUser(body.key, channelId, authorId, text);
        }
    }
}
