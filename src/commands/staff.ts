import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { ModeratorsService } from '../services/moderators.service';

@Injectable()
export class StaffHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly moderatorsService: ModeratorsService,
    ) {
    }

    getSignature(): string {
        return '!staff';
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const moderatorIds = this.moderatorsService.getModeratorIds();

        // intenta resolver los IDs a usernames, si falla muestra el ID crudo
        const lines = await Promise.all(moderatorIds.map(async id => {
            const user = await this.botService.getUserData(Number(id));
            return user?.username ? `- @${user.username}` : `- ${id}`;
        }));

        const text = this.messagesService.get('STAFF', {
            MODERATORS: lines.length ? lines.join('\n') : '(sin moderadores configurados)',
        });
        await this.botService.sendReply(body.key, body.message.channel.id, text);
    }
}
