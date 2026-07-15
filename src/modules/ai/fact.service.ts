import { Injectable, Logger } from '@nestjs/common';
import { AiRaceService } from './ai-race.service';

/**
 * Le pide a la IA (Gemini/Groq en carrera) un dato curioso relacionado con el
 * mundo Femdom/BDSM: histórico, cultural, o sobre alguna figura pública.
 * Usado por !dato.
 */
@Injectable()
export class FactService {
    private readonly logger = new Logger(FactService.name);

    constructor(private readonly aiRaceService: AiRaceService) {
    }

    async getFact(): Promise<string | null> {
        const prompt = this.buildPrompt();
        this.logger.debug(`Prompt de !dato enviado a la IA:\n${prompt}`);
        const response = await this.aiRaceService.generateText(prompt);
        this.logger.debug(`Respuesta cruda de la IA (dato): ${response}`);
        return response ? response.trim() : null;
    }

    private buildPrompt(): string {
        return `Sos un divulgador cultural para un canal de rol Femdom/BDSM. Contame un dato curioso, interesante y real relacionado con el mundo Femdom/BDSM: puede ser un dato histórico, una curiosidad cultural, el origen de algún término o práctica, o algo llamativo sobre el tema en general.

IMPORTANTE si mencionás a una persona real (viva o histórica): hacelo SOLO si es información pública y ya conocida — algo que la persona haya contado ella misma en una entrevista, libro, o similar, o un dato histórico/académico ya establecido (por ejemplo, el origen de las palabras "sadismo" y "masoquismo", que vienen de nombres históricos reales y documentados). NUNCA inventes ni repitas rumores sin confirmar sobre la vida privada de alguien, ni le atribuyas prácticas a una persona que no las haya hecho pública ella misma. Si no estás seguro de que un dato sobre una persona puntual sea público y verificable, NO lo menciones — elegí en su lugar un dato histórico o cultural general, sin nombrar a nadie.

Escribí el dato en un párrafo de aproximadamente 4 líneas. Tono informal, voseo rioplatense natural ("tenés", "sabías", "podés"), sin modismos marcados (nada de "che", "posta", "de una").

Respondé ÚNICAMENTE con el dato en sí, sin comillas, sin markdown, sin texto adicional.`;
    }
}
