import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { resolveConfigPath } from '../util/config-path';

/**
 * Traduce los códigos de tags que devuelve la API de Mazmo (ej: "SLAVE", "PODOPHYLLUM")
 * a nombres legibles, usando config/tags.json. Si un código no está en el diccionario,
 * se muestra tal cual vino (mejor eso que ocultarlo).
 */
@Injectable()
export class TagsService {
    private readonly logger = new Logger('TagsService');
    private translations: { [code: string]: string } = {};

    constructor() {
        this.load();
    }

    private load() {
        const tagsPath = resolveConfigPath('tags.json');
        try {
            const raw = fs.readFileSync(tagsPath, 'utf-8');
            const parsed = JSON.parse(raw);
            delete parsed._comentario;
            this.translations = parsed;
        } catch (e) {
            this.logger.warn('No se pudo cargar config/tags.json, se van a mostrar los códigos sin traducir');
            this.translations = {};
        }
    }

    translate(code: string): string {
        return this.translations[code] ?? code;
    }

    translateAll(codes: string[]): string[] {
        return (codes ?? []).map(code => this.translate(code));
    }
}
