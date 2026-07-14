import { Injectable, Logger } from '@nestjs/common';
import { AiRaceService } from './ai-race.service';
import { UserData } from '../../types';
import { TagsService } from '../../services/tags.service';
import { getZodiacSign } from '../../util/zodiac';

export type AstralCompatibilityResult = {
    porcentaje: number,
    descripcion: string,
};

/**
 * Versión satírica/cómica de la compatibilidad, basada en el "Signo Zodiacal
 * Mazmorrero" (calculado con la fecha de REGISTRO en Mazmo, no el nacimiento real).
 */
@Injectable()
export class AstralCompatibilityService {
    private readonly logger = new Logger(AstralCompatibilityService.name);

    constructor(
        private readonly aiRaceService: AiRaceService,
        private readonly tagsService: TagsService,
    ) {
    }

    async getAstralCompatibility(user1: UserData, user2: UserData): Promise<AstralCompatibilityResult | null> {
        const prompt = this.buildPrompt(user1, user2);
        this.logger.debug(`Prompt astral enviado a la IA:\n${prompt}`);
        const response = await this.aiRaceService.generateText(prompt);
        this.logger.debug(`Respuesta cruda de la IA (astral): ${response}`);
        if (!response) {
            return null;
        }
        return this.parseResponse(response);
    }

    private describeUser(user: UserData): string {
        const tags = (user.tags && user.tags.length) ? this.tagsService.translateAll(user.tags).join(', ') : 'sin etiquetas';
        const regdate = user.regdate ? new Date(user.regdate) : null;
        const sign = regdate ? getZodiacSign(regdate) : 'desconocido';
        const fechaFormateada = regdate ? regdate.toLocaleDateString('es-AR', { timeZone: 'UTC' }) : 'desconocida';

        return `@${user.username ?? 'desconocido'} (${user.displayname ?? '-'}), Signo Zodiacal Mazmorrero: ${sign} (por su fecha de registro ${fechaFormateada}), género: ${user.gender ?? '-'}, etiquetas: ${tags}`;
    }

    private buildPrompt(user1: UserData, user2: UserData): string {
        return `Sos un astrólogo cósmico de mentira, muy exagerado y con mucho humor, especializado en un canal de rol Femdom/BDSM. Vas a hacer una "lectura de compatibilidad astral" 100% satírica y en joda, basada en el "Signo Zodiacal Mazmorrero" de cada usuario (que se calcula con la fecha en la que se registraron en la plataforma, NO su fecha de nacimiento real — dejalo claro como parte del chiste, como si el cosmos mazmorrero funcionara así).

Usuario 1: ${this.describeUser(user1)}
Usuario 2: ${this.describeUser(user2)}

SIEMPRE mencioná el Signo Zodiacal Mazmorrero de cada uno con su fecha de registro, pero resumido en UNA sola línea corta (no el párrafo completo tipo "El Signo Zodiacal Mazmorrero de X es Y por su registro el Z..." — con algo breve tipo "Signos: {nombre1} ({signo1}, reg. {fecha1}) y {nombre2} ({signo2}, reg. {fecha2})" alcanza).

Después de eso, hacé una lectura cómica y exagerada de la combinación de signos, tirando rasgos de personalidad típicos de la astrología occidental (Tauro es terco, Cáncer es sensible, Leo es dramático, etc.) pero llevados a joda, cruzándolos con sus etiquetas/roles de forma chistosa (por ejemplo si uno es Dominante y el signo es mandón, hacé un chiste combinando ambas cosas).

Tono: informal, con humor absurdo tipo horóscopo de revista pero mucho más exagerado y picante, sin ser ofensivo con nadie real (es todo en joda). Podés usar voseo natural.

IMPORTANTE sobre el largo: la respuesta COMPLETA (incluyendo la mención de los signos y fechas) tiene que tener como máximo 5 o 6 líneas en total, nada más. Nada de listas con viñetas ni de desarrollar cada etiqueta por separado — elegí solo 1 o 2 etiquetas de cada uno, las más graciosas o relevantes, y metelas en el chiste general. Priorizá que sea corto y contundente por sobre exhaustivo.

El "porcentaje" en este caso es un "% de compatibilidad cósmica" arbitrario y de joda, no tiene que ser objetivo ni realista — jugá con el número para que sea parte del chiste (podés poner un porcentaje raro tipo 66% o 420% si el chiste lo permite, no hace falta ser serio con el número).

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, con este formato exacto:
{"porcentaje": <número entero>, "descripcion": "<la lectura astral completa en el tono descripto arriba, máximo 5 o 6 líneas>"}`;
    }

    private parseResponse(response: string): AstralCompatibilityResult | null {
        try {
            const cleaned = response.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (typeof parsed.porcentaje === 'number' && typeof parsed.descripcion === 'string') {
                return {
                    porcentaje: Math.round(parsed.porcentaje),
                    descripcion: parsed.descripcion,
                };
            }
            return null;
        } catch (e) {
            this.logger.error('No se pudo parsear la respuesta astral de la IA: ' + response);
            return null;
        }
    }
}
