import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { resolveConfigPath } from '../util/config-path';
import { ConfigService } from './config.service';

/**
 * Carga config/mensajes.txt (formato por bloques [NOMBRE_BLOQUE]) y arma los textos
 * finales reemplazando variables tipo {VARIABLE}. Todos los textos visibles del bot
 * deben salir de acá, nunca hardcodeados en los commandHandlers/servicios.
 */
@Injectable()
export class MessagesService {
    private blocks: { [key: string]: string } = {};

    constructor(private readonly configService: ConfigService) {
        this.load();
    }

    private load() {
        const messagesPath = resolveConfigPath('mensajes.txt');
        const raw = fs.readFileSync(messagesPath, 'utf-8');

        // separa el archivo por encabezados [BLOQUE]
        const regex = /\[([A-Z0-9_]+)\]\s*\n([\s\S]*?)(?=\n\[[A-Z0-9_]+\]|$)/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(raw)) !== null) {
            const [, blockName, content] = match;
            this.blocks[blockName] = content.trim();
        }
    }

    /**
     * Devuelve el texto de un bloque de mensajes.txt con las variables reemplazadas.
     * @param blockName Nombre del bloque, ej: 'AYUDA'
     * @param extraVariables Variables adicionales específicas del comando, ej: { USERNAME: 'foo' }
     */
    get(blockName: string, extraVariables: { [key: string]: string } = {}): string {
        const template = this.blocks[blockName];
        if (!template) {
            return `[mensaje "${blockName}" no encontrado en mensajes.txt]`;
        }

        const variables = { ...this.configService.getBaseVariables(), ...extraVariables };
        return template.replace(/\{([A-Z0-9_]+)\}/g, (fullMatch, varName) => {
            return variables[varName] !== undefined ? variables[varName] : fullMatch;
        });
    }
}
