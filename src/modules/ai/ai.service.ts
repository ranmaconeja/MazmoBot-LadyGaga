import { HttpService, Injectable, Logger } from '@nestjs/common';

/**
 * Llama a la API gratuita de Google Gemini (Google AI Studio) para generar texto.
 * Requiere GEMINI_API_KEY en el .env, se saca gratis en https://aistudio.google.com/
 * (sin tarjeta de crédito, límite diario gratuito).
 */
@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private readonly model = 'gemini-flash-latest';

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
