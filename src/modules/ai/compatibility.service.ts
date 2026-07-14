import { Injectable, Logger } from '@nestjs/common';
import { AiRaceService } from './ai-race.service';
import { UserData } from '../../types';
import { TagsService } from '../../services/tags.service';

export type CompatibilityResult = {
    porcentaje: number,
    descripcion: string,
};

@Injectable()
export class CompatibilityService {
    private readonly logger = new Logger(CompatibilityService.name);

    constructor(
        private readonly aiRaceService: AiRaceService,
        private readonly tagsService: TagsService,
    ) {
    }

    async getCompatibility(user1: UserData, user2: UserData): Promise<CompatibilityResult | null> {
        const prompt = this.buildPrompt(user1, user2);
        this.logger.debug(`Prompt enviado a la IA:\n${prompt}`);
        const response = await this.aiRaceService.generateText(prompt);
        this.logger.debug(`Respuesta cruda de la IA: ${response}`);
        if (!response) {
            return null;
        }
        return this.parseResponse(response);
    }

    private describeUser(user: UserData): string {
        const tags = (user.tags && user.tags.length) ? this.tagsService.translateAll(user.tags).join(', ') : 'sin etiquetas';
        const ubicacion = user.region?.name ? `${user.region.name}, ${user.country?.name ?? '-'}` : (user.country?.name ?? '-');
        return `@${user.username ?? 'desconocido'} (${user.displayname ?? '-'}), género: ${user.gender ?? '-'}, etiquetas: ${tags}, ubicación: ${ubicacion}, miembro desde: ${user.regdate ?? 'desconocido'}, lo/la conocen ${user.knowedCount ?? 0} personas, participó en ${user.eventCount ?? 0} eventos del canal`;
    }

    private buildPrompt(user1: UserData, user2: UserData): string {
        return `Sos un asistente de un canal de rol Femdom/BDSM que evalúa qué tan compatibles son dos perfiles en base a sus etiquetas (roles, prácticas, preferencias).

Usuario 1: ${this.describeUser(user1)}
Usuario 2: ${this.describeUser(user2)}

Evaluá la compatibilidad entre ambos perfiles pensando en roles complementarios (ej: Dominante + Sumiso suele ser compatible; Dominante + Dominante suele ser menos compatible), afinidad general de prácticas/etiquetas, y género de cada uno como parte del contexto (sin asumir de antemano que una combinación de géneros es mejor o peor, pero sí mencionándolo si es relevante para la dinámica que buscan).

Además, para cada usuario, hacé un comentario breve sobre qué tan conocido/activo es en la comunidad, usando estos criterios (no los repitas textualmente ni menciones los números de los tramos, solo aplicá el criterio con tus palabras):
- Cantidad de gente que lo/la conoce: 0-10 → lo conocen algunos usuarios nomás; 11-50 → es una persona sociable en la comunidad; 51-100 → es un miembro activo de la comunidad; más de 100 → tiene un montón de gente a la que le podrías preguntar referencias sobre él/ella.
- Cantidad de eventos: 1 → se animó a participar de la comunidad; 2-5 → disfruta de la comunidad; más de 5 → seguro te lo cruzás en algún evento.
- Caso especial: si tiene 0 en ambas cosas, decilo como que posiblemente sea nuevo en la comunidad — a menos que la fecha de "miembro desde" sea de hace bastante tiempo, en cuyo caso decilo como que parece ser poco sociable en vez de nuevo.

Este comentario sobre cada usuario sumalo dentro del mismo párrafo de la descripción, no lo pongas aparte.

Sé realista y objetivo con el porcentaje, no optimista por defecto: pensá también en los factores negativos concretos, no solo en los positivos. Por ejemplo:
- Si viven en países o ciudades distintas, mencionalo como un obstáculo real (pero aclarando que se podría resolver si alguno de los dos puede viajar o mudarse, no lo trates como algo imposible).
- Si los roles no calzan bien (ej: uno es Switch pero el otro es exclusivamente Dominante, lo que puede dejar al Switch sin poder ejercer su lado Dominante; o directamente los dos son Dominantes y ninguno cede), mencionalo como una fricción concreta que podría generar frustración, no lo barras bajo la alfombra.
- Si hay puntos realmente compatibles, mencionalos también — la idea es un balance realista, ni todo color de rosa ni todo catastrófico.
El porcentaje final tiene que reflejar ese balance: si encontrás varios obstáculos reales, el número tiene que ser bajo o medio, no alto solo por compromiso.

Escribí la descripción con tono informal y relajado, como comentándoselo a un amigo. Usá voseo natural ("tenés", "sos", "podés") porque así habla la gente acá, pero NO uses modismos ni jerga marcada (nada de "che", "posta", "de una", "picante", "buena onda" ni cosas por el estilo) — la idea es que suene natural y cotidiano, no como una caricatura de argentino. Que sea un párrafo de 5 a 7 oraciones (ahora hay más cosas para cubrir: etiquetas, obstáculos/puntos a favor, y el comentario de qué tan conocido es cada uno), explayándote en por qué le pusiste ese porcentaje.

IMPORTANTE sobre las etiquetas: usá criterio al nombrarlas en español, no traducción literal forzada. Hay términos de la jerga BDSM que la comunidad hispanohablante ya usa tal cual en inglés porque suena natural y es como se conocen (por ejemplo: "Switch", "Petplay", "Bondage", "Roleplay") — esos dejalos en inglés, sin traducir. Otros sí tienen una traducción directa y natural que se usa normalmente en español (por ejemplo: "Dominant" → "Dominante", "Submissive" → "Sumiso/a") — esos traducilos. La regla es: si al traducirlo suena forzado o raro, dejalo en inglés; si suena natural, traducilo.

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, con este formato exacto:
{"porcentaje": <número entero de 0 a 100>, "descripcion": "<párrafo de 5 a 7 oraciones en el tono descripto arriba, en español rioplatense>"}`;
    }

    private parseResponse(response: string): CompatibilityResult | null {
        try {
            // por si la IA envuelve el JSON en \`\`\`json ... \`\`\` a pesar de lo pedido
            const cleaned = response.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (typeof parsed.porcentaje === 'number' && typeof parsed.descripcion === 'string') {
                return {
                    porcentaje: Math.max(0, Math.min(100, Math.round(parsed.porcentaje))),
                    descripcion: parsed.descripcion,
                };
            }
            return null;
        } catch (e) {
            this.logger.error('No se pudo parsear la respuesta de la IA: ' + response);
            return null;
        }
    }
}
