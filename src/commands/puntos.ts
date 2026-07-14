import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { PointsService } from '../services/points.service';

@Injectable()
export class PuntosHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly pointsService: PointsService,
    ) {
    }

    getSignature(): string {
        return '!puntos';
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const userId = body.message.author.id;

        if (this.pointsService.isExempt(userId)) {
            const text = this.messagesService.get('PUNTOS_EXENTO');
            await this.botService.sendReply(body.key, body.message.channel.id, text);
            return;
        }

        const points = await this.pointsService.getPoints(userId);
        const text = this.messagesService.get('PUNTOS', {
            POINTS: String(points),
            COST: String(this.pointsService.getCommandCost()),
        });
        await this.botService.sendReply(body.key, body.message.channel.id, text);
    }
}
