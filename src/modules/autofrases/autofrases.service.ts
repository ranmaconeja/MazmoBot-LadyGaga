import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import { resolveConfigPath } from '../../util/config-path';

type Trigger = {
    keywords: string[],
    response: string,
};

/**
 * Carga config/autofrases.txt (formato "palabra1|palabra2 = respuesta") y permite
 * chequear si un mensaje entrante dispara alguna respuesta automática.
 *
 * Ejemplo: si alguien escribe "Busco Dom activo", y hay una línea
 * "busco dom = <respuesta>", el bot contesta automáticamente esa respuesta.
 */
@Injectable()
export class AutofrasesService implements OnModuleInit {
    private readonly logger = new Logger(AutofrasesService.name);
    private triggers: Trigger[] = [];

    onModuleInit() {
        this.loadTriggers();
    }

    private loadTriggers() {
        const frasesPath = resolveConfigPath('autofrases.txt');
        const raw = fs.readFileSync(frasesPath, 'utf-8');

        this.triggers = raw
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#') && line.includes('='))
            .map(line => {
                const [keywordsRaw, ...responseParts] = line.split('=');
                const keywords = keywordsRaw.split('|').map(k => k.trim().toLowerCase()).filter(Boolean);
                const response = responseParts.join('=').trim();
                return { keywords, response };
            })
            .filter(trigger => trigger.keywords.length && trigger.response);

        this.logger.log(`Cargados ${this.triggers.length} disparadores de autofrases`);
    }

    /**
     * Devuelve la respuesta configurada para el primer disparador que coincida
     * con el mensaje recibido, o null si ninguno coincide.
     */
    checkMessage(rawContent: string): string | null {
        if (!rawContent) {
            return null;
        }
        const text = rawContent.toLowerCase();

        for (const trigger of this.triggers) {
            if (trigger.keywords.some(keyword => text.includes(keyword))) {
                return trigger.response;
            }
        }

        return null;
    }
}
