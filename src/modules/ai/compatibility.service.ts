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
        return `${user.displayname ?? user.username ?? 'desconocido'}, género: ${user.gender ?? '-'}, etiquetas: ${tags}, miembro desde: ${user.regdate ?? 'desconocido'}, lo/la conocen ${user.knowedCount ?? 0} personas, participó en ${user.eventCount ?? 0} eventos del canal`;
    }

    private buildPrompt(user1: UserData, user2: UserData): string {
        return `Sos un asistente de un canal de rol Femdom/BDSM que evalúa qué tan compatibles son dos perfiles en base a sus etiquetas (roles, prácticas, preferencias).

Usuario 1: ${this.describeUser(user1)}
Usuario 2: ${this.describeUser(user2)}

Evaluá la compatibilidad pensando en roles complementarios (ej: Dominante + Sumiso suele ser compatible; Dominante + Dominante suele ser menos compatible) y afinidad general de etiquetas/prácticas.

Sé realista, no optimista por defecto: si hay un obstáculo concreto (ej: roles que no calzan bien entre sí), mencionalo brevemente; si el match es bueno, decilo también. El porcentaje tiene que reflejar tu evaluación real, bajalo tanto como te parezca que corresponde si encontrás obstáculos genuinos. NO menciones ubicación, distancia geográfica, ni de dónde es cada usuario — ese dato no es relevante para este análisis y no tenés que traerlo a colación.

IMPORTANTE sobre cómo nombrar a cada persona (esto es crítico, no es solo estilo): cada vez que aparece un "@Nombre" en el mensaje, esa persona recibe una notificación real en el chat — así que podés usar el @ alguna vez si te resulta natural, pero como MÁXIMO una vez por persona en todo el párrafo (nunca 3, 4 o más veces seguidas como en un mensaje de spam). Mencioná el nombre de cada persona como mucho dos veces en total (una con @ si querés, y como mucho una vez más sin @) — de ahí en más, referite a ella por su rol principal (ej: "la Dominante", "el Switch", "quien tiene el rol de Sumisa") en vez de repetir el nombre — NO uses pronombres como "ella"/"él" para diferenciarlas, porque si las dos personas comparten género se vuelve confuso saber a quién te referís; el rol, en cambio, siempre las distingue bien ya que es justo lo que estás comparando. Si alguna de las dos no tiene ningún tag de rol claro, usá "la primera persona"/"la segunda persona" en su lugar.

Organizá el párrafo así: primero lo relevante del primer usuario, después lo relevante del segundo, y por último la conclusión sobre cómo calzan entre sí — no vayas saltando de uno a otro todo el tiempo.

IMPORTANTE sobre el largo: la descripción tiene que ser un párrafo de 4 a 5 oraciones, desarrollando bien la razón del porcentaje.

Escribí con tono informal y relajado, voseo natural ("tenés", "sos", "podés"), sin modismos marcados (nada de "che", "posta", "de una").

IMPORTANTE sobre las etiquetas: las etiquetas que te paso ya vienen traducidas al español (o dejadas en inglés cuando así se usan naturalmente en la jerga BDSM hispanohablante) — usalas tal cual te las doy, no las vuelvas a traducir ni le cambies el idioma.

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, con este formato exacto:
{"porcentaje": <número entero de 0 a 100>, "descripcion": "<párrafo de 4 a 5 oraciones, en español rioplatense>"}`;
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
