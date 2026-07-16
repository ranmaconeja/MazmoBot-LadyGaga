import { Injectable, Logger } from '@nestjs/common';
import { AiRaceService } from './ai-race.service';

/**
 * Le pide a la IA (Gemini/Groq en carrera) un dato curioso relacionado con el
 * mundo Femdom/BDSM: histórico, cultural, de cine/música/TV, o una curiosidad
 * práctica. Usado por !dato.
 */
@Injectable()
export class FactService {
    private readonly logger = new Logger(FactService.name);

    constructor(private readonly aiRaceService: AiRaceService) {
    }

    async getFact(previousFacts: string[]): Promise<string | null> {
        const prompt = this.buildPrompt(previousFacts);
        this.logger.debug(`Prompt de !dato enviado a la IA:\n${prompt}`);
        const response = await this.aiRaceService.generateText(prompt);
        this.logger.debug(`Respuesta cruda de la IA (dato): ${response}`);
        return response ? response.trim() : null;
    }

    private buildPrompt(previousFacts: string[]): string {
        const previousList = previousFacts.length
            ? previousFacts.map(fact => `- ${fact}`).join('\n')
            : '(ninguno todavía, es el primero)';

        return `Sos un divulgador cultural para un canal de rol Femdom/BDSM. Contame UN dato curioso, interesante y real relacionado con el mundo Femdom/BDSM. Elegí LIBREMENTE entre categorías bien distintas de una vez a otra, por ejemplo:
- Un dato histórico o el origen de algún término o práctica.
- Una referencia en cine, series o TV (ej: una escena o personaje conocido con una dinámica de Dom/sumisión).
- Una referencia en música (ej: una canción o artista conocido con temática Femdom/BDSM en su obra o imagen pública).
- Una curiosidad práctica sobre alguna herramienta o técnica (ej: tipos de vela para wax play, materiales de bondage, etc.).
- Una curiosidad cultural o de la comunidad BDSM en general.

No te limites solo a lo histórico — variá bastante la categoría de una consulta a otra.

IMPORTANTE, no podés repetir ninguno de estos datos ya usados antes (ni uno muy parecido en tema o enfoque):
${previousList}

IMPORTANTE si mencionás a una persona real (viva o histórica) o su vida privada: hacelo SOLO si es información pública y ya conocida — algo que la persona haya contado ella misma en una entrevista, libro, o similar, o un dato histórico/académico ya establecido. NUNCA inventes ni repitas rumores sin confirmar sobre la vida privada de alguien, ni le atribuyas prácticas privadas a una persona que no las haya hecho públicas ella misma. Esto NO aplica a obras o personajes públicos de esa persona (canciones, películas, personajes de ficción, su imagen artística pública) — eso sí lo podés mencionar libremente, como cualquier dato de cultura pop. Si no estás seguro de que un dato sobre la vida privada de alguien sea público y verificable, no lo menciones — elegí otra categoría en su lugar.

Escribí el dato en un párrafo de aproximadamente 4 líneas. Tono informal, voseo rioplatense natural ("tenés", "sabías", "podés"), sin modismos marcados (nada de "che", "posta", "de una").

Respondé ÚNICAMENTE con el dato en sí, sin comillas, sin markdown, sin texto adicional.`;
    }
}
