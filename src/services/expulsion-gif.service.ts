import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { resolveConfigPath } from '../util/config-path';

/**
 * Carga config/gifs-expulsion.json y elige uno al azar cuando se detecta una
 * expulsión. Ver ExpulsionHandler para el disparador (todavía pendiente de
 * confirmar si Mazmo manda algún webhook para esto).
 */
@Injectable()
export class ExpulsionGifService {
    private readonly logger = new Logger('ExpulsionGifService');
    private gifs: string[] = [];

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

    getRandomGif(): string | null {
        if (!this.gifs.length) {
            return null;
        }
        const index = Math.floor(Math.random() * this.gifs.length);
        return this.gifs[index];
    }
}
