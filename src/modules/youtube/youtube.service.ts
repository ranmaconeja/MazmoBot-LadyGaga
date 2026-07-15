import { HttpService, Injectable, Logger } from '@nestjs/common';

export type YoutubeVideoInfo = {
    title: string,
    description: string,
    thumbnailUrl: string,
};

export type YoutubeSearchResult = {
    videoId: string,
    title: string,
};

/**
 * Detecta links de YouTube en un mensaje y obtiene su información.
 *
 * Hay dos modos, según si configurás YOUTUBE_API_KEY en el .env:
 * - CON API key (recomendado): usa la YouTube Data API v3 y trae título, descripción
 *   completa y miniatura. La key es gratis, se saca en https://console.cloud.google.com/
 *   habilitando "YouTube Data API v3" y generando una API key.
 * - SIN API key: usa el endpoint público de oEmbed de YouTube (no requiere credenciales),
 *   pero éste NO devuelve descripción, solo título, autor y miniatura.
 */
@Injectable()
export class YoutubeService {
    private readonly logger = new Logger(YoutubeService.name);

    // largo máximo de la descripción antes de recortarla, para no mandar mensajes gigantes
    private readonly MAX_DESCRIPTION_LENGTH = 300;

    constructor(private readonly httpService: HttpService) {
    }

    /**
     * Busca el primer link de YouTube (youtube.com/watch, youtu.be, youtube.com/shorts)
     * dentro de un texto y devuelve su ID de video, o null si no hay ninguno.
     */
    extractVideoId(text: string): string | null {
        if (!text) {
            return null;
        }
        const match = text.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    }

    /**
     * Busca un video REAL en YouTube a partir de un texto libre (ej: "Artista -
     * Canción"), usando la YouTube Data API v3. Requiere YOUTUBE_API_KEY — a
     * diferencia de getVideoInfo, esto no tiene respaldo por oEmbed porque
     * oEmbed no ofrece búsqueda, solo consultar un video ya identificado por
     * ID. Usado por !musica: nunca confiamos en que la IA invente el video ID
     * (los modelos de lenguaje "alucinan" IDs de YouTube con facilidad, ya que
     * son strings arbitrarios que no tienen forma de memorizar bien), así que
     * la IA solo sugiere el nombre de la canción y esto busca el video real.
     */
    async searchVideo(query: string): Promise<YoutubeSearchResult | null> {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
            this.logger.warn('YOUTUBE_API_KEY no configurada: no se puede buscar videos por texto (solo consultar por ID vía oEmbed).');
            return null;
        }

        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${apiKey}`;
        const res = await this.httpService.get(url).toPromise().catch(e => {
            this.logger.error('Error buscando en YouTube Data API: ' + (e?.response?.data ? JSON.stringify(e.response.data) : e.message));
            return null;
        });

        const item = res?.data?.items?.[0];
        const videoId = item?.id?.videoId;
        if (!videoId) {
            return null;
        }
        return {
            videoId,
            title: item?.snippet?.title ?? query,
        };
    }

    async getVideoInfo(videoId: string): Promise<YoutubeVideoInfo | null> {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (apiKey) {
            const infoFromApi = await this.getVideoInfoFromDataApi(videoId, apiKey);
            if (infoFromApi) {
                return infoFromApi;
            }
            // si falla la Data API (key inválida, cuota agotada, etc.) cae al oEmbed como respaldo
        }
        return this.getVideoInfoFromOembed(videoId);
    }

    private async getVideoInfoFromDataApi(videoId: string, apiKey: string): Promise<YoutubeVideoInfo | null> {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
        const res = await this.httpService.get(url).toPromise().catch(() => null);
        const snippet = res?.data?.items?.[0]?.snippet;
        if (!snippet) {
            return null;
        }
        return {
            title: snippet.title,
            description: this.truncateDescription(snippet.description),
            thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url,
        };
    }

    private async getVideoInfoFromOembed(videoId: string): Promise<YoutubeVideoInfo | null> {
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const res = await this.httpService.get(url).toPromise().catch(() => null);
        if (!res?.data) {
            return null;
        }
        return {
            title: res.data.title,
            description: '(agregá YOUTUBE_API_KEY en el .env para mostrar la descripción del video)',
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        };
    }

    private truncateDescription(description: string): string {
        if (!description) {
            return '(sin descripción)';
        }
        const firstLine = description.split('\n')[0];
        return firstLine.length > this.MAX_DESCRIPTION_LENGTH
            ? firstLine.slice(0, this.MAX_DESCRIPTION_LENGTH) + '...'
            : firstLine;
    }
}
