import * as path from 'path';
import * as fs from 'fs';

/**
 * Resuelve la ruta absoluta a un archivo dentro de config/, probando varias
 * ubicaciones posibles:
 *
 * 1. process.cwd() + config/ — funciona en Render y en local, donde el proceso
 *    siempre arranca desde la raíz del proyecto.
 * 2. Relativo a este mismo archivo (subiendo desde dist/util o src/util hasta la
 *    raíz del proyecto) — necesario en Vercel, donde cada función serverless
 *    puede ejecutarse con un process.cwd() distinto a la raíz del repo.
 *
 * Si ninguna existe, devuelve la primera opción para que el error de
 * "no se pudo leer" sea claro.
 */
export function resolveConfigPath(filename: string): string {
    const candidates = [
        path.join(process.cwd(), 'config', filename),
        path.join(__dirname, '..', '..', 'config', filename),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return candidates[0];
}
