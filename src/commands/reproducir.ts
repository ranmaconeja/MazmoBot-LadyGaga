import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { YoutubeService } from '../modules/youtube/youtube.service';
import { PlayerQueueService } from '../modules/player/player-queue.service';

/**
 * Uso: M!p <link de YouTube>
 * Agrega el link a la cola del reproductor (ver PlayerQueueService). El programa
 * de Windows la va a levantar en su próximo poll a GET /player/next.
 */
@Injectable()
export class ReproducirHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly youtubeService: YoutubeService,
        private readonly playerQueueService: PlayerQueueService,
    ) {
    }

    getSignature(): string {
        return 'M!p';
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const link = message.trim();

        const videoId = this.youtubeService.extractVideoId(link);
        if (!videoId) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('REPRODUCIR_LINK_INVALIDO'));
            return;
        }

        const author = await this.botService.getUserData(body.message.author.id);
        const requestedBy = author?.username ?? String(body.message.author.id);

        await this.playerQueueService.enqueue(link, requestedBy);
        const clienteActivo = await this.playerQueueService.hasActiveClient();

        const text = clienteActivo
            ? this.messagesService.get('REPRODUCIR_OK', { LINK: link })
            : this.messagesService.get('REPRODUCIR_SIN_CLIENTE');

        await this.botService.sendReply(body.key, channelId, text);
    }
}
