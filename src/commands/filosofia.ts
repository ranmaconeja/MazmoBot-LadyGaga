import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';

@Injectable()
export class FilosofiaHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
    ) {
    }

    getSignature(): string {
        return '!filosofia';
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const text = this.messagesService.get('FILOSOFIA');
        await this.botService.sendReply(body.key, body.message.channel.id, text);
    }
}
