import { Injectable, Logger } from '@nestjs/common';
import { AiRaceService } from './ai-race.service';

/**
 * Le pide a la IA (Gemini/Groq en carrera) una canción de YouTube ideal para
 * un canal Femdom/BDSM. Usado por !musica.
 */
@Injectable()
export class MusicService {
    private readonly logger = new Logger(MusicService.name);

    constructor(private readonly aiRaceService: AiRaceService) {
    }

    async suggestSong(recentSongs: string[], recentArtists: string[]): Promise<string | null> {
        const prompt = this.buildPrompt(recentSongs, recentArtists);
        this.logger.debug(`Prompt de !musica enviado a la IA:\n${prompt}`);
        const response = await this.aiRaceService.generateText(prompt);
        this.logger.debug(`Respuesta cruda de la IA (musica): ${response}`);
        return response ? response.trim() : null;
    }

    private buildPrompt(recentSongs: string[], recentArtists: string[]): string {
        const recentSongsList = recentSongs.length
            ? recentSongs.map(song => `- ${song}`).join('\n')
            : '(ninguna todavía)';
        const recentArtistsList = recentArtists.length
            ? recentArtists.map(artist => `- ${artist}`).join('\n')
            : '(ninguno todavía)';

        return `Sos un DJ que recomienda música para un canal de rol Femdom/BDSM. Recomendá UNA sola canción real y conocida, con como mínimo 5 millones de reproducciones en YouTube, cuyo tono, letra o clima quede bien con la temática del canal (sensual, intenso, dominante, oscuro, etc. — no hace falta que sea literalmente sobre BDSM, usá criterio).

IMPORTANTE, no podés repetir ninguna de estas canciones ya sugeridas en los últimos 30 días:
${recentSongsList}

IMPORTANTE, tampoco podés repetir a ninguno de estos artistas, usados en los últimos 10 pedidos (elegí un artista distinto a todos estos):
${recentArtistsList}

Respondé ÚNICAMENTE con el nombre del artista y el título de la canción, en el formato exacto: Artista - Título de la canción
Sin URL, sin comillas, sin markdown, sin explicación — solo esa línea, nada más.`;
    }
}
