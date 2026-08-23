import { HttpService, Injectable, Logger } from '@nestjs/common';

/**
 * Llama a la API gratuita de Google Gemini (Google AI Studio) para generar texto.
 * Requiere GEMINI_API_KEY en el .env, se saca gratis en https://aistudio.google.com/
 * (sin tarjeta de crédito, límite diario gratuito).
 */
@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    // ⚠️ 19/08/2026: antes usaba el alias 'gemini-flash-latest', que Google
    // repunta automáticamente al modelo Flash más nuevo que va sacando —
    // hace poco pasó a apuntar a Gemini 3.5 Flash sin ningún aviso, y eso
    // rompió la IA de un día para el otro sin que se tocara nada del código.
    // Se fija un modelo concreto para que esto no vuelva a pasar de sorpresa;
    // si en el futuro hay que migrar a uno más nuevo, mejor hacerlo a
    // propósito (revisando antes que el modelo elegido esté disponible en el
    // plan gratis) que dejar que Google lo decida solo.
    private readonly model = 'gemini-3.5-flash';

    constructor(private readonly httpService: HttpService) {
    }

    /**
     * Envía un prompt a Gemini y devuelve el texto de respuesta, o null si falla
     * (por ejemplo si falta la API key o se agotó la cuota gratuita del día).
     */
    async generateText(prompt: string): Promise<string | null> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY no configurada en el .env, no se puede usar la IA');
            return null;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`;
        const body = {
            contents: [{ parts: [{ text: prompt }] }],
        };

        const config = {
            timeout: 25000, // evita que la request quede colgada para siempre si Gemini no responde
        };

        const res = await this.httpService.post(url, body, config).toPromise().catch(e => {
            this.logger.error('Error llamando a Gemini: ' + (e?.response?.data ? JSON.stringify(e.response.data) : e.message));
            return null;
        });

        const text = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? text.trim() : null;
    }
}
