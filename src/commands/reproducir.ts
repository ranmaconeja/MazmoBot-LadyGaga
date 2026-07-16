import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable, Logger } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { YoutubeService } from '../modules/youtube/youtube.service';
import { PlayerQueueService } from '../modules/player/player-queue.service';

/**
 * Uso: !radio <link de YouTube>
 * Agrega el link a la cola del reproductor (ver PlayerQueueService). El programa
 * de Windows la va a levantar en su próximo poll a GET /player/next.
 * Apto para cualquier usuario (no requiere ser moderador/owner), cuesta el
 * costo estándar en puntos como cualquier otro comando (ver PointsService).
 */
@Injectable()
export class ReproducirHandler implements CommandHandler {
    private readonly logger = new Logger('ReproducirDiag');

    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly youtubeService: YoutubeService,
        private readonly playerQueueService: PlayerQueueService,
    ) {
    }

    getSignature(): string {
        return '!radio';
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

        // DIAGNOSTICO TEMPORAL: por qué a veces el reproductor de Windows muestra
        // el ID en vez del username (ver memoria del proyecto). Sacar este log
        // una vez resuelto.
        this.logger.log(`DIAG author: ${JSON.stringify(body.message.author)}`);
        this.logger.log(`DIAG userMentions: ${JSON.stringify((body.message.payload as any)?.userMentions)}`);

        const author = await this.botService.getUserData(body.message.author.id);
        this.logger.log(`DIAG getUserData resultado: ${JSON.stringify(author)}`);
        const requestedBy = author?.username ?? String(body.message.author.id);

        await this.playerQueueService.enqueue(link, requestedBy);
        const clienteActivo = await this.playerQueueService.hasActiveClient();

        const text = clienteActivo
            ? this.messagesService.get('REPRODUCIR_OK', { LINK: link })
            : this.messagesService.get('REPRODUCIR_SIN_CLIENTE');

        await this.botService.sendReply(body.key, channelId, text);
    }
}
