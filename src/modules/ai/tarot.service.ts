import { Injectable, Logger } from '@nestjs/common';
import { AiRaceService } from './ai-race.service';

export type CardPick = {
    nombre: string,
    orientacion: 'derecha' | 'invertida',
};

// Arcanos Mayores 0 a X: desarrollo individual, mundo interno, experiencias y aprendizajes personales
const GRUPO_INTERNO = [
    '0 - El Loco',
    'I - El Mago',
    'II - La Sacerdotisa',
    'III - La Emperatriz',
    'IV - El Emperador',
    'V - El Hierofante',
    'VI - Los Enamorados',
    'VII - El Carro',
    'VIII - La Fuerza',
    'IX - El Ermitaño',
    'X - La Rueda de la Fortuna',
];

// Arcanos Mayores XI a XXI: proyección hacia lo externo, transformación, relaciones, culminación
const GRUPO_EXTERNO = [
    'XI - La Justicia',
    'XII - El Colgado',
    'XIII - La Muerte',
    'XIV - La Templanza',
    'XV - El Diablo',
    'XVI - La Torre',
    'XVII - La Estrella',
    'XVIII - La Luna',
    'XIX - El Sol',
    'XX - El Juicio',
    'XXI - El Mundo',
];

@Injectable()
export class TarotService {
    private readonly logger = new Logger(TarotService.name);

    constructor(private readonly aiRaceService: AiRaceService) {
    }

    /**
     * Elige al azar una carta del grupo "interno" (0-X) y otra del "externo"
     * (XI-XXI), cada una con su orientación al azar. Se hace en código, no
     * se le pide a la IA que "elija" — así se garantiza que respeta los
     * grupos correctos y que de verdad varía de una tirada a otra.
     */
    pickCards(): { carta1: CardPick, carta2: CardPick } {
        const pickRandom = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)];
        const pickOrientacion = (): 'derecha' | 'invertida' => Math.random() < 0.5 ? 'derecha' : 'invertida';

        return {
            carta1: { nombre: pickRandom(GRUPO_INTERNO), orientacion: pickOrientacion() },
            carta2: { nombre: pickRandom(GRUPO_EXTERNO), orientacion: pickOrientacion() },
        };
    }

    /**
     * Le pide a la IA (Gemini/Groq en carrera) la interpretación de las dos
     * cartas YA elegidas (ver pickCards), en 2 líneas cada una.
     */
    async interpretCards(carta1: CardPick, carta2: CardPick): Promise<{ significado1: string, significado2: string } | null> {
        const prompt = this.buildPrompt(carta1, carta2);
        this.logger.debug(`Prompt de !tarot enviado a la IA:\n${prompt}`);
        const response = await this.aiRaceService.generateText(prompt);
        this.logger.debug(`Respuesta cruda de la IA (tarot): ${response}`);
        if (!response) {
            return null;
        }
        return this.parseResponse(response);
    }

    private buildPrompt(carta1: CardPick, carta2: CardPick): string {
        return `Sos un tarotista para un canal de rol Femdom/BDSM. Te paso dos cartas del Tarot (Arcanos Mayores) YA elegidas, cada una con su orientación (derecha o invertida) — vos NO elegís las cartas, solo interpretalas.

Carta 1 (representa el desarrollo interno/personal, el mundo interno, experiencias y aprendizajes propios): "${carta1.nombre}", orientación: ${carta1.orientacion}.
Carta 2 (representa la proyección hacia lo externo, transformación, relaciones con el mundo, culminación de un proceso): "${carta2.nombre}", orientación: ${carta2.orientacion}.

Para cada carta, escribí su significado EN 2 LÍNEAS, teniendo en cuenta la orientación puntual que te di (invertida cambia bastante el sentido respecto a derecha — no repitas el mismo significado para las dos orientaciones). Podés, si viene al caso, darle un pequeño matiz relacionado a la temática del canal (vínculos, roles, entrega, control), pero sin forzarlo si la carta no tiene mucho que ver.

Tono cálido, cercano, voseo rioplatense natural ("tenés", "podés", "vas a"), sin modismos marcados (nada de "che", "posta", "de una").

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, con este formato exacto:
{"significado1": "<2 líneas para la carta 1>", "significado2": "<2 líneas para la carta 2>"}`;
    }

    private parseResponse(response: string): { significado1: string, significado2: string } | null {
        try {
            const cleaned = response.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (typeof parsed.significado1 === 'string' && typeof parsed.significado2 === 'string') {
                return { significado1: parsed.significado1, significado2: parsed.significado2 };
            }
            return null;
        } catch (e) {
            this.logger.error('No se pudo parsear la respuesta de la IA (tarot): ' + response);
            return null;
        }
    }
}
