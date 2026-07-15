/**
 * Devuelve la fecha calendario actual en Argentina (UTC-3, fijo todo el año —
 * Argentina no tiene horario de verano desde 2009) en formato YYYY-MM-DD.
 * Alcanza con restar 3 horas al UTC actual y leer la fecha resultante, sin
 * necesidad de ninguna librería de timezones.
 */
export function getArgentinaDateString(date: Date = new Date()): string {
    const argentinaTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return argentinaTime.toISOString().slice(0, 10);
}
