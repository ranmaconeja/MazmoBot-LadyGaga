import { HttpService, Injectable, Logger } from '@nestjs/common';

/**
 * Llama a la API gratuita de Groq (LPU, muy rápida) usando el modelo
 * llama-3.3-70b-versatile. Requiere GROQ_API_KEY en el .env, se saca gratis
 * en https://console.groq.com/keys (sin tarjeta).
 */
@Injectable()
export class GroqService {
    private readonly logger = new Logger(GroqService.name);
    private readonly model = 'llama-3.3-70b-versatile';

    constructor(private readonly httpService: HttpService) {
    }

    /**
     * Envía un prompt a Groq y devuelve el texto de respuesta, o null si falla
     * (por ejemplo si falta la API key o se agotó la cuota gratuita del día).
     */
    async generateText(prompt: string): Promise<string | null> {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            this.logger.warn('GROQ_API_KEY no configurada en el .env, no se puede usar Groq');
            return null;
        }

        const url = 'https://api.groq.com/openai/v1/chat/completions';
        const body = {
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
        };
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            timeout: 25000, // evita que la request quede colgada para siempre si Groq no responde
        };

        const res = await this.httpService.post(url, body, config).toPromise().catch(e => {
            this.logger.error('Error llamando a Groq: ' + (e?.response?.data ? JSON.stringify(e.response.data) : e.message));
            return null;
        });

        const text = res?.data?.choices?.[0]?.message?.content;
        return text ? text.trim() : null;
    }
}
