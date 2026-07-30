import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable, Logger } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { MusicService } from '../modules/ai/music.service';
import { YoutubeService } from '../modules/youtube/youtube.service';
import { MusicHistoryRepository } from '../database/music-history.repository';

/**
 * Uso: !musica (sin argumentos).
 * Le pide a la IA el nombre de una canción "ideal para BDSM" con mínimo 5
 * millones de vistas (según la IA — no verificado) y busca el video REAL en
 * YouTube a partir de ese nombre, en vez de confiarle a la IA la URL/ID
 * directamente (ver music.service.ts para el porqué).
 *
 * Reglas de repetición (usando music_history en Turso):
 * - No repite una canción ya sugerida en los últimos 30 días.
 * - No repite un artista usado en los últimos 10 pedidos.
 * Ambas reglas se le piden a la IA en el prompt, y ADEMÁS se validan acá
 * después de la respuesta (con reintentos) — el prompt solo no es 100%
 * confiable para una regla numérica como "1 cada 10 pedidos".
 *
 * Publica el título, la descripción y la miniatura directamente (no depende
 * de que Mazmo dispare el webhook /message para los mensajes del propio bot
 * — se confirmó que eso NO pasa en la práctica).
 *
 * Requiere YOUTUBE_API_KEY configurada (la búsqueda por texto solo la ofrece
 * la Data API, a diferencia de la detección pasiva de links que tiene
 * respaldo por oEmbed).
 */
@Injectable()
export class MusicaHandler implements CommandHandler {
    private readonly logger = new Logger('MusicaHandler');

    // intentos máximos para conseguir una sugerencia que respete la regla
    // del artista antes de rendirse y usar la última igual
    private readonly MAX_ATTEMPTS = 3;

    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly musicService: MusicService,
        private readonly youtubeService: YoutubeService,
        private readonly musicHistoryRepository: MusicHistoryRepository,
    ) {
    }

    getSignature(): string {
        return '!musica';
    }

    /**
     * Separa "Artista - Título" en sus dos partes. Si la IA no respetó el
     * formato exacto, usa la sugerencia completa como "artista" (mejor eso
     * que romper, ya que solo se usa para el chequeo de repetición).
     */
    private parseSuggestion(suggestion: string): { artist: string, title: string } {
        const separatorIndex = suggestion.indexOf(' - ');
        if (separatorIndex === -1) {
            return { artist: suggestion, title: suggestion };
        }
        return {
            artist: suggestion.slice(0, separatorIndex).trim(),
            title: suggestion.slice(separatorIndex + 3).trim(),
        };
    }

    async handleCommand(req: Request, res: Response, message: string): Promise<void> {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;

        const recentSongs = await this.musicHistoryRepository.getRecentSongs(30);
        const recentArtists = await this.musicHistoryRepository.getRecentArtists(10);
        const recentArtistsLower = recentArtists.map(artist => artist.toLowerCase());

        let suggestion: string | null = null;
        let parsed: { artist: string, title: string } | null = null;

        for (let attempt = 1; attempt <= this.MAX_ATTEMPTS; attempt++) {
            const candidate = await this.musicService.suggestSong(recentSongs, recentArtists);
            if (!candidate) {
                break;
            }
            const candidateParsed = this.parseSuggestion(candidate);
            const repiteArtista = recentArtistsLower.includes(candidateParsed.artist.toLowerCase());

            suggestion = candidate;
            parsed = candidateParsed;

            if (!repiteArtista) {
                break; // sugerencia válida, no hace falta reintentar
            }
            this.logger.warn(`!musica: intento ${attempt} repitió un artista de los últimos 10 pedidos ("${candidateParsed.artist}"), reintentando`);
        }

        if (!suggestion || !parsed) {
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

        await this.musicHistoryRepository.save({
            artist: parsed.artist,
            title: parsed.title,
            suggestion,
        });

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
