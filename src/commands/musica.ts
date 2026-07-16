import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable, Logger } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { MusicService } from '../modules/ai/music.service';
import { YoutubeService } from '../modules/youtube/youtube.service';

/**
 * Uso: !musica (sin argumentos).
 * Le pide a la IA el nombre de una canción "ideal para BDSM" con mínimo 10
 * millones de vistas (según la IA — no verificado) y busca el video REAL en
 * YouTube a partir de ese nombre, en vez de confiarle a la IA la URL/ID
 * directamente.
 *
 * Por qué ese cambio: al principio le pedíamos la URL completa a la IA, y
 * terminaba "alucinando" IDs de video que no existen (los IDs de YouTube son
 * strings arbitrarios de 11 caracteres que un modelo de lenguaje no tiene
 * forma de memorizar bien, a diferencia de nombres de canciones/artistas
 * reales, que sí forman parte de lo que aprendió). Ahora la IA solo sugiere
 * el nombre, y youtubeService.searchVideo() lo busca de verdad en la Data API
 * — así el ID siempre sale de una búsqueda real, nunca de la IA.
 *
 * Publica el título, la descripción y la miniatura directamente (mismo
 * mecanismo que la detección pasiva de links en app.controller.ts), en vez de
 * depender de que Mazmo dispare el webhook /message para los mensajes que
 * publica el propio bot — se confirmó que eso NO pasa en la práctica, así que
 * había que armar el mensaje completo acá mismo.
 *
 * Requiere YOUTUBE_API_KEY configurada (a diferencia de la detección de links
 * pegados por usuarios, que tiene respaldo por oEmbed, la búsqueda por texto
 * solo la ofrece la Data API — oEmbed no busca, solo consulta un ID ya conocido).
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

        const searchResult = await this.youtubeService.searchVideo(suggestion);
        if (!searchResult) {
            this.logger.warn(`!musica: no se encontró un video real para la sugerencia de la IA: "${suggestion}" (¿falta YOUTUBE_API_KEY?)`);
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('MUSICA_IA_ERROR'));
            return;
        }

        const url = `https://www.youtube.com/watch?v=${searchResult.videoId}`;

        // trae título/descripción/miniatura completos del video ya confirmado
        const videoInfo = await this.youtubeService.getVideoInfo(searchResult.videoId);
        if (!videoInfo) {
            // no debería pasar (search recién lo encontró), pero por las dudas
            // no se pierde la recomendación entera por esto: se manda al menos la URL
            this.logger.warn(`!musica: se encontró el video (${searchResult.videoId}) pero no se pudo traer su info completa`);
            await this.botService.sendReply(body.key, channelId, url);
            return;
        }

        const text = this.messagesService.get('MUSICA_RESULT', {
            TITLE: videoInfo.title,
            DESCRIPTION: videoInfo.description,
            THUMBNAIL_URL: videoInfo.thumbnailUrl,
            URL: url,
        });
        await this.botService.sendReply(body.key, channelId, text);
    }
}
