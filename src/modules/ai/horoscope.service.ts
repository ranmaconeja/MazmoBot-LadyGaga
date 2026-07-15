import { Injectable, Logger } from '@nestjs/common';
import { AiRaceService } from './ai-race.service';
import { UserData } from '../../types';
import { TagsService } from '../../services/tags.service';

export type HoroscopeResult = {
    esSignoValido: boolean,
    horoscopo: string,
};

/**
 * Le pide a la IA (Gemini/Groq en carrera, ver AiRaceService) que:
 * 1. Confirme si el texto recibido corresponde a uno de los 12 signos del
 *    zodíaco occidental (tolerando errores de tipeo, mayúsculas o tildes).
 * 2. Si es válido, arme un horóscopo corto combinando los rasgos típicos del
 *    signo con las etiquetas del perfil del usuario.
 * Usado por !horoscopo.
 */
@Injectable()
export class HoroscopeService {
    private readonly logger = new Logger(HoroscopeService.name);

    constructor(
        private readonly aiRaceService: AiRaceService,
        private readonly tagsService: TagsService,
    ) {
    }

    async getHoroscope(signo: string, user: UserData): Promise<HoroscopeResult | null> {
        const prompt = this.buildPrompt(signo, user);
        this.logger.debug(`Prompt de !horoscopo enviado a la IA:\n${prompt}`);
        const response = await this.aiRaceService.generateText(prompt);
        this.logger.debug(`Respuesta cruda de la IA (horoscopo): ${response}`);
        if (!response) {
            return null;
        }
        return this.parseResponse(response);
    }

    private describeTags(user: UserData): string {
        return (user.tags && user.tags.length) ? this.tagsService.translateAll(user.tags).join(', ') : 'sin etiquetas';
    }

    private buildPrompt(signo: string, user: UserData): string {
        return `Sos un astrólogo de un canal de rol Femdom/BDSM. Te van a pasar un signo del zodíaco tal como lo escribió un usuario (puede tener errores de tipeo, mayúsculas/minúsculas, o faltarle tildes) y las etiquetas de su perfil.

Los 12 signos válidos del zodíaco occidental son: Aries, Tauro, Géminis, Cáncer, Leo, Virgo, Libra, Escorpio, Sagitario, Capricornio, Acuario, Piscis.

Signo consultado: "${signo}"
Etiquetas del usuario: ${this.describeTags(user)}

Primero confirmá si "${signo}" corresponde a uno de esos 12 signos — aceptá variantes de tipeo, mayúsculas o tildes razonables (ej: "escorpio", "ACUARIO", "geminis" sin tilde son válidos), pero NO aceptes nada que no sea un signo real del zodíaco.

Si NO es uno de los 12 signos: dejá el campo del horóscopo como un string vacío, no inventes nada.

Si SÍ es un signo válido: escribí un horóscopo breve (3 a 4 líneas) que combine los rasgos típicos de ese signo con las etiquetas/roles del usuario de forma ingeniosa y con humor (ej: si es Leo y tiene la etiqueta Dominante, jugá con que a un Leo ya de por sí le gusta ser el centro de atención, y el rol de Dominante lo potencia). Tono informal, voseo rioplatense natural ("tenés", "sos", "podés"), picante pero sin ser ofensivo con nadie real. NO uses modismos marcados (nada de "che", "posta", "de una", "boludo/a") ni arranques la respuesta con una interjección — la idea es que suene natural y cotidiano, no como una caricatura de argentino.

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, con este formato exacto:
{"esSignoValido": <true o false>, "horoscopo": "<el horóscopo si el signo es válido, o "" si no lo es>"}`;
    }

    private parseResponse(response: string): HoroscopeResult | null {
        try {
            const cleaned = response.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (typeof parsed.esSignoValido === 'boolean' && typeof parsed.horoscopo === 'string') {
                return {
                    esSignoValido: parsed.esSignoValido,
                    horoscopo: parsed.horoscopo,
                };
            }
            return null;
        } catch (e) {
            this.logger.error('No se pudo parsear la respuesta de la IA (horoscopo): ' + response);
            return null;
        }
    }
}
