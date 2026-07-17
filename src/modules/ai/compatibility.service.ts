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

Evaluá la compatibilidad pensando en roles complementarios (ej: Dominante + Sumiso suele ser compatible; Dominante + Dominante suele ser menos compatible) y afinidad general de etiquetas/prácticas.

Sé realista, no optimista por defecto: si hay un obstáculo concreto (roles que no calzan por ejemplo), mencionalo brevemente; si el match es bueno, decilo también. Elegí lo más relevante para mencionar, no trates de cubrir todos los aspectos posibles.

Sobre la ubicacion, menciona la distancia, pero no restes % de compatibilidad

IMPORTANTE sobre el largo: la descripción tiene que ser un párrafo CORTO de 3 a 4 oraciones como máximo — priorizá ser breve y directo por sobre exhaustivo, yendo derecho a la razón principal del porcentaje.

Escribí con tono informal y relajado, voseo natural ("tenés", "sos", "podés"), sin modismos marcados (nada de "che", "posta", "de una").

IMPORTANTE sobre las etiquetas: las etiquetas que te paso ya vienen traducidas al español (o dejadas en inglés cuando así se usan naturalmente en la jerga BDSM hispanohablante) — usalas tal cual te las doy, no las vuelvas a traducir ni le cambies el idioma.

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, con este formato exacto:
{"porcentaje": <número entero de 0 a 100>, "descripcion": "<párrafo de 2 a 3 oraciones cortas, en español rioplatense>"}`;
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
