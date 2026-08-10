import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { ModeratorsService } from '../services/moderators.service';

/**
 * Uso: !nombre <ID numérico o username> — solo moderadores/owner. Devuelve el
 * username y nombre de perfil de ese usuario, siempre por privado a quien lo
 * pidió (nunca se publica en el canal, a diferencia de !perfil).
 * Útil para chequear rápido de quién es un ID que aparece en algún lado
 * (logs, links, etc.) sin tener que armar un !perfil público.
 */
@Injectable()
export class NombreHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly moderatorsService: ModeratorsService,
    ) {
    }

    getSignature(): string {
        return '!nombre';
    }

    async handleCommand(req: Request, res: Response, message: string): Promise<void> {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const authorId = body.message.author.id;

        if (!this.moderatorsService.isModerator(authorId)) {
            await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('NOT_MODERATOR'));
            return;
        }

        const identifier = message.trim().replace('@', '');
        if (!identifier) {
            await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('NOMBRE_USAGE'));
            return;
        }

        const user = !isNaN(Number(identifier))
            ? await this.botService.getUserData(Number(identifier))
            : await this.botService.getUserDataByUsername(identifier);

        if (!user) {
            await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('NOMBRE_ERROR', { ID: identifier }));
            return;
        }

        const text = this.messagesService.get('NOMBRE_RESULT', {
            ID: String(user.id),
            USERNAME: user.username ?? '(sin username)',
            DISPLAYNAME: user.displayname ?? '-',
        });
        await this.botService.notifyUser(body.key, channelId, authorId, text);
    }
}
