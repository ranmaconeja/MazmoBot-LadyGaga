import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import { resolveConfigPath } from '../../util/config-path';

/**
 * Detecta mensajes de "búsqueda" (ej: "busco Dominante", "necesito una Sumisa")
 * sin usar IA. Se configura en config/busquedas.txt con 3 líneas:
 * DISPARADORES (palabras de intención), ROLES (palabras de rol/práctica) y
 * RESPUESTA (el texto que contesta el bot).
 *
 * Dispara solo si el mensaje contiene AL MENOS UNA palabra de cada lista,
 * sin importar el orden ni que estén pegadas — así "busco un Dominante" y
 * "necesito que alguien me spankee" disparan, pero "busco una página de
 * anime" no (tiene disparador pero ningún rol).
 */
@Injectable()
export class BusquedaService implements OnModuleInit {
    private readonly logger = new Logger('BusquedaService');
    private disparadores: string[] = [];
    private roles: string[] = [];
    private respuesta: string = '';

    onModuleInit() {
        this.load();
    }

    private load() {
        const filePath = resolveConfigPath('busquedas.txt');
        const raw = fs.readFileSync(filePath, 'utf-8');

        for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }
            if (trimmed.toUpperCase().startsWith('DISPARADORES:')) {
                this.disparadores = this.parseList(trimmed.substring(trimmed.indexOf(':') + 1));
            } else if (trimmed.toUpperCase().startsWith('ROLES:')) {
                this.roles = this.parseList(trimmed.substring(trimmed.indexOf(':') + 1));
            } else if (trimmed.toUpperCase().startsWith('RESPUESTA:')) {
                this.respuesta = trimmed.substring(trimmed.indexOf(':') + 1).trim();
            }
        }

        this.logger.log(`Cargados ${this.disparadores.length} disparadores y ${this.roles.length} roles para detección de búsquedas`);
    }

    private parseList(raw: string): string[] {
        return raw.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
    }

    /**
     * Devuelve la respuesta configurada si el mensaje matchea (disparador + rol),
     * o null si no.
     */
    checkMessage(rawContent: string): string | null {
        if (!rawContent || !this.disparadores.length || !this.roles.length || !this.respuesta) {
            return null;
        }

        const text = rawContent.toLowerCase();
        const tieneDisparador = this.disparadores.some(palabra => text.includes(palabra));
        if (!tieneDisparador) {
            return null;
        }

        const tieneRol = this.roles.some(palabra => text.includes(palabra));
        if (!tieneRol) {
            return null;
        }

        return this.respuesta;
    }
}
