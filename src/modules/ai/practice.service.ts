import { Injectable, Logger } from '@nestjs/common';
import { AiRaceService } from './ai-race.service';

export type PracticeResult = {
    esBdsm: boolean,
    descripcion: string,
};

/**
 * Le pide a la IA (Gemini/Groq en carrera, ver AiRaceService) que evalúe si una
 * práctica/actividad consultada es BDSM. Si lo es, devuelve una descripción de
 * ~4 líneas; si no, devuelve una respuesta corta explicando que no tiene nada
 * que ver con el BDSM. Usado por !practica.
 */
@Injectable()
export class PracticeService {
    private readonly logger = new Logger(PracticeService.name);

    constructor(private readonly aiRaceService: AiRaceService) {
    }

    async evaluate(practica: string): Promise<PracticeResult | null> {
        const prompt = this.buildPrompt(practica);
        this.logger.debug(`Prompt de !practica enviado a la IA:\n${prompt}`);
        const response = await this.aiRaceService.generateText(prompt);
        this.logger.debug(`Respuesta cruda de la IA (practica): ${response}`);
        if (!response) {
            return null;
        }
        return this.parseResponse(response);
    }

    private buildPrompt(practica: string): string {
        return `Sos un asistente educativo de un canal de rol Femdom/BDSM. Te van a pasar el nombre de una práctica, actividad o kink, y tenés que evaluar si es algo reconocido dentro del mundo BDSM (por ejemplo: bondage, spanking, petplay, primal, rope play, findom, degradación, sensory play, etc., aunque esté escrito en inglés, mal escrito, o sea poco común) o si es algo completamente ajeno al BDSM (un deporte, una comida, un objeto cotidiano, una actividad random, etc.).

Práctica consultada: "${practica}"

Si NO es una práctica BDSM: respondé breve y directo (1 a 2 oraciones), explicando que eso no tiene nada que ver con el BDSM y pidiendo que se hagan consultas coherentes con la temática del canal. Tono informal pero no burlón ni despectivo.

Si SÍ es una práctica BDSM: dame una descripción clara y educativa de aproximadamente 4 líneas, explicando en qué consiste, qué roles suele involucrar si aplica (ej: quién ejerce y quién recibe), y si es relevante algún apunte breve de consenso/seguridad. No hace falta que menciones "consenso" si la práctica no lo amerita explícitamente, no lo fuerces en cada respuesta.

Tono en ambos casos: informal y cercano, voseo rioplatense natural ("tenés", "sos", "podés"), sin modismos marcados tipo "che", "posta", "de una".

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, con este formato exacto:
{"esBdsm": <true o false>, "descripcion": "<el texto según corresponda arriba>"}`;
    }

    private parseResponse(response: string): PracticeResult | null {
        try {
            const cleaned = response.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (typeof parsed.esBdsm === 'boolean' && typeof parsed.descripcion === 'string') {
                return {
                    esBdsm: parsed.esBdsm,
                    descripcion: parsed.descripcion,
                };
            }
            return null;
        } catch (e) {
            this.logger.error('No se pudo parsear la respuesta de la IA (practica): ' + response);
            return null;
        }
    }
}
