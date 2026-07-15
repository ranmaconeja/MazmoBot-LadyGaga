import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable, Logger } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { MusicService } from '../modules/ai/music.service';
import { YoutubeService } from '../modules/youtube/youtube.service';

/**
 * Uso: !musica (sin argumentos).
 * Le pide a la IA una canción de YouTube "ideal para BDSM" con mínimo 10
 * millones de vistas (según la IA — no verificado en tiempo real, ver nota
 * abajo) y publica SOLO la URL en el canal.
 *
 * La idea es que el detector automático de links de YouTube (ver
 * app.controller.ts, se dispara en cualquier mensaje que traiga un link) se
 * active solo con el propio mensaje que publica el bot, agregando el
 * título/miniatura como si lo hubiera pegado un usuario cualquiera.
 *
 * OJO — dos limitaciones reales:
 * 1. La IA no tiene acceso a YouTube en tiempo real, así que "10 millones de
 *    reproducciones" es lo que la IA cree recordar, no un dato confirmado.
 *    Para evitar publicar un video inventado, se verifica que el ID exista de
 *    verdad (getVideoInfo) antes de publicarlo — eso confirma que el video
 *    existe, pero NO confirma la cantidad real de vistas.
 * 2. Que la miniatura/título aparezcan automáticamente depende de que Mazmo
 *    mande el webhook /message también para los mensajes que publica el
 *    propio bot — esto no está confirmado. Si no pasa en la práctica, avisen
 *    y se cambia para que !musica publique la info completa directamente, sin
 *    depender de este "auto-lectura".
 */
@Injectable()
export class MusicaHandler implements CommandHandler {
    private readonly logger = new Logger('MusicaHandler');

    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly musicService: MusicService,
        private readonly youtubeService: YoutubeService,
    ) {
    }

    getSignature(): string {
        return '!musica';
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;

        const suggestion = await this.musicService.suggestSong();
        if (!suggestion) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('MUSICA_IA_ERROR'));
            return;
        }

        const videoId = this.youtubeService.extractVideoId(suggestion);
        if (!videoId) {
            this.logger.warn(`!musica: la IA no devolvió una URL de YouTube reconocible: "${suggestion}"`);
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('MUSICA_IA_ERROR'));
            return;
        }

        // confirma que el video exista de verdad, ya que la IA puede
        // "alucinar" un ID inexistente al no tener acceso real a YouTube
        const videoInfo = await this.youtubeService.getVideoInfo(videoId);
        if (!videoInfo) {
            this.logger.warn(`!musica: la IA sugirió un video que no existe o no se pudo verificar (id: ${videoId})`);
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('MUSICA_IA_ERROR'));
            return;
        }

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        await this.botService.sendReply(body.key, channelId, url);
    }
}
