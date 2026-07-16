import { Injectable, Logger } from '@nestjs/common';
import { AiRaceService } from './ai-race.service';

/**
 * Le pide a la IA (Gemini/Groq en carrera) una "pregunta del día" con
 * temática Femdom/BDSM sobre experiencias, para que la comunidad debata en
 * el chat. Usado por !dia.
 */
@Injectable()
export class QuestionOfDayService {
    private readonly logger = new Logger(QuestionOfDayService.name);

    constructor(private readonly aiRaceService: AiRaceService) {
    }

    async generateQuestion(previousQuestions: string[]): Promise<string | null> {
        const prompt = this.buildPrompt(previousQuestions);
        this.logger.debug(`Prompt de !dia enviado a la IA:\n${prompt}`);
        const response = await this.aiRaceService.generateText(prompt);
        this.logger.debug(`Respuesta cruda de la IA (dia): ${response}`);
        return response ? response.trim() : null;
    }

    private buildPrompt(previousQuestions: string[]): string {
        const previousList = previousQuestions.length
            ? previousQuestions.map(q => `- ${q}`).join('\n')
            : '(ninguna todavía, es la primera)';

        return `Necesito que me realices una pregunta sobre Experiencias Femdom, o que opinás sobre cierta temática o práctica Femdom, para que la comunidad de un canal de rol Femdom/BDSM debata en el chat. No podés repetir preguntas previas.

Preguntas ya usadas anteriormente (NO repitas ninguna de estas, ni una muy parecida):
${previousList}

La pregunta (o consulta de opinión) tiene que ser abierta (no de sí/no), invitar a compartir experiencias u opiniones personales, tener un tono cálido y respetuoso (nunca invasiva ni incómoda), y estar en español rioplatense con voseo natural ("tenés", "contanos", "qué opinás de..."). NO uses modismos marcados (nada de "che", "posta", "de una").

Respondé ÚNICAMENTE con la pregunta, una sola oración (como mucho dos). Sin comillas, sin markdown, sin numerarla, sin título ni texto adicional — solo la pregunta en sí.`;
    }
}
