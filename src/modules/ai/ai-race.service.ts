import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { GroqService } from './groq.service';

/**
 * Le manda el mismo prompt a Gemini y a Groq AL MISMO TIEMPO, y devuelve la
 * primera respuesta válida que llegue (la otra se descarta). Si la más rápida
 * de las dos falla (devuelve null), espera a la otra antes de rendirse.
 *
 * Usar este servicio para CUALQUIER consulta que necesite IA, en vez de llamar
 * a AiService o GroqService directamente — así todo lo que use IA se beneficia
 * de la redundancia (si una de las dos falla o se queda sin cuota, la otra
 * responde igual) y de quedarse con la más rápida.
 */
@Injectable()
export class AiRaceService {
    private readonly logger = new Logger('AiRace');

    constructor(
        private readonly aiService: AiService,
        private readonly groqService: GroqService,
    ) {
    }

    async generateText(prompt: string): Promise<string | null> {
        const startedAt = Date.now();

        const gemini = this.aiService.generateText(prompt).then(result => {
            this.logger.log(`Gemini respondió en ${Date.now() - startedAt}ms (${result ? 'OK' : 'null/falló'})`);
            return { provider: 'Gemini', result };
        }).catch(() => {
            this.logger.log(`Gemini falló en ${Date.now() - startedAt}ms`);
            return { provider: 'Gemini', result: null };
        });

        const groq = this.groqService.generateText(prompt).then(result => {
            this.logger.log(`Groq respondió en ${Date.now() - startedAt}ms (${result ? 'OK' : 'null/falló'})`);
            return { provider: 'Groq', result };
        }).catch(() => {
            this.logger.log(`Groq falló en ${Date.now() - startedAt}ms`);
            return { provider: 'Groq', result: null };
        });

        const winner = await this.firstNonNull([gemini, groq]);

        if (winner) {
            this.logger.log(`Ganó ${winner.provider} (${Date.now() - startedAt}ms totales) — se descarta la otra respuesta`);
            return winner.result;
        }

        this.logger.warn(`Ninguna de las dos IA pudo responder (${Date.now() - startedAt}ms totales)`);
        return null;
    }

    /**
     * Devuelve el primer resultado con `result` no nulo. Si todas terminan en null,
     * devuelve null recién cuando ya terminaron todas (no antes).
     */
    private firstNonNull<T extends { result: string | null }>(promises: Promise<T>[]): Promise<T | null> {
        return new Promise(resolve => {
            let remaining = promises.length;
            let settled = false;

            for (const p of promises) {
                p.then(value => {
                    remaining--;
                    if (!settled && value.result) {
                        settled = true;
                        resolve(value);
                    } else if (remaining === 0 && !settled) {
                        settled = true;
                        resolve(null);
                    }
                });
            }
        });
    }
}
