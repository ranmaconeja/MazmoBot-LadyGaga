import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { resolveConfigPath } from '../util/config-path';

/**
 * Carga config/moderadores.txt (un ID de usuario por línea, # para comentarios)
 * y permite validar si un usuario es moderador. El dueño del bot (OWNER_ID en .env)
 * siempre es considerado moderador.
 */
@Injectable()
export class ModeratorsService {
    private moderatorIds: Set<string> = new Set();

    constructor() {
        this.load();
    }

    private load() {
        const modsPath = resolveConfigPath('moderadores.txt');
        const raw = fs.readFileSync(modsPath, 'utf-8');

        this.moderatorIds = new Set(
            raw
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#')),
        );
    }

    isModerator(userId: number | string): boolean {
        const id = String(userId);
        return id === process.env.OWNER_ID || this.moderatorIds.has(id);
    }

    getModeratorIds(): string[] {
        return Array.from(this.moderatorIds);
    }
}
