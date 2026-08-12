import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { resolveConfigPath } from '../util/config-path';

export type ExpulsionGif = {
    url: string,
    texto: string,
};

/**
 * Carga config/gifs-expulsion.json y elige uno al azar (con su texto
 * correspondiente) cuando se detecta una expulsión.
 */
@Injectable()
export class ExpulsionGifService {
    private readonly logger = new Logger('ExpulsionGifService');
    private gifs: ExpulsionGif[] = [];

    constructor() {
        this.load();
    }

    private load() {
        const gifsPath = resolveConfigPath('gifs-expulsion.json');
        try {
            const raw = fs.readFileSync(gifsPath, 'utf-8');
            const parsed = JSON.parse(raw);
            this.gifs = Array.isArray(parsed.gifs) ? parsed.gifs : [];
        } catch (e) {
            this.logger.warn('No se pudo cargar config/gifs-expulsion.json, no hay GIFs de expulsión disponibles');
            this.gifs = [];
        }
    }

    getRandomGif(): ExpulsionGif | null {
        if (!this.gifs.length) {
            return null;
        }
        const index = Math.floor(Math.random() * this.gifs.length);
        return this.gifs[index];
    }
}
