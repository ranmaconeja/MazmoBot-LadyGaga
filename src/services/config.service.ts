import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { resolveConfigPath } from '../util/config-path';

export type BotConfig = {
    BOT_NAME: string,
    CHANNEL_NAME: string,
    OWNER: string,
    VERSION: string,
};

/**
 * Carga config/config.json y expone sus valores. Ninguna de estas variables
 * debe estar hardcodeada en el resto del código, siempre se debe leer desde acá.
 */
@Injectable()
export class ConfigService {
    private config: BotConfig;

    constructor() {
        const configPath = resolveConfigPath('config.json');
        const raw = fs.readFileSync(configPath, 'utf-8');
        this.config = JSON.parse(raw);
    }

    get(): BotConfig {
        return this.config;
    }

    /**
     * Variables base disponibles para reemplazo en mensajes.txt
     */
    getBaseVariables(): { [key: string]: string } {
        return {
            BOT_NAME: this.config.BOT_NAME,
            CHANNEL_NAME: this.config.CHANNEL_NAME,
            OWNER: this.config.OWNER,
            VERSION: this.config.VERSION,
        };
    }
}
