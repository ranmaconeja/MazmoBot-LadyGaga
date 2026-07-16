import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';

@Injectable()
export class VersionHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
    ) {
    }

    getSignature(): string {
        return '!version';
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const text = this.messagesService.get('VERSION');
        await this.botService.sendReply(body.key, body.message.channel.id, text);
    }
}
