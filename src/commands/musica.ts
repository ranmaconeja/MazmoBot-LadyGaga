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
 * millones de vistas (según la IA — no verificado, ver nota abajo) y busca el
 * video REAL en YouTube a partir de ese nombre, en vez de confiarle a la IA
 * la URL/ID directamente.
 *
 * Por qué el cambio: al principio le pedíamos la URL completa a la IA, y
 * terminaba "alucinando" IDs de video que no existen (los IDs de YouTube son
 * strings arbitrarios de 11 caracteres que un modelo de lenguaje no tiene
 * forma de memorizar bien, a diferencia de nombres de canciones/artistas
 * reales, que sí forman parte de lo que aprendió). Ahora la IA solo sugiere
 * el nombre, y youtubeService.searchVideo() lo busca de verdad en la Data API
 * — así el ID siempre sale de una búsqueda real, nunca de la IA.
 *
 * Requiere YOUTUBE_API_KEY configurada (a diferencia de la detección de links
 * pegados por usuarios, que tiene respaldo por oEmbed, la búsqueda por texto
 * solo la ofrece la Data API — oEmbed no busca, solo consulta un ID ya conocido).
 *
 * OJO: que la miniatura/título aparezcan automáticamente en el canal (además
 * de la URL que publica este comando) depende de que Mazmo mande el webhook
 * /message también para los mensajes que publica el propio bot — esto no está
 * confirmado. Si no pasa en la práctica, avisen y se cambia para que !musica
 * publique la info completa directamente, sin depender de esta "auto-lectura".
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

        const result = await this.youtubeService.searchVideo(suggestion);
        if (!result) {
            this.logger.warn(`!musica: no se encontró un video real para la sugerencia de la IA: "${suggestion}" (¿falta YOUTUBE_API_KEY?)`);
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('MUSICA_IA_ERROR'));
            return;
        }

        const url = `https://www.youtube.com/watch?v=${result.videoId}`;
        await this.botService.sendReply(body.key, channelId, url);
    }
}
