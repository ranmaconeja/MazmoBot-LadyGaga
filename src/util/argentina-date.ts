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

/**
 * Calcula cuánto falta (en horas y minutos) para la próxima medianoche en
 * Argentina, que es cuando cambia la fecha de getArgentinaDateString() de
 * arriba y por lo tanto cuándo se genera la próxima pregunta del día.
 */
export function getTimeUntilNextArgentinaMidnight(date: Date = new Date()): { hours: number, minutes: number } {
    const argentinaTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    // "medianoche argentina" del día siguiente, expresada en la misma
    // representación desplazada que usamos arriba
    const nextMidnightShifted = Date.UTC(
        argentinaTime.getUTCFullYear(),
        argentinaTime.getUTCMonth(),
        argentinaTime.getUTCDate() + 1,
        0, 0, 0, 0,
    );
    // volvemos a un instante UTC real sumando de nuevo las 3 horas que restamos antes
    const nextMidnightRealUtc = nextMidnightShifted + 3 * 60 * 60 * 1000;

    const totalMinutes = Math.max(0, Math.round((nextMidnightRealUtc - date.getTime()) / 60000));
    return {
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
    };
}

/**
 * Formatea el resultado de getTimeUntilNextArgentinaMidnight() como texto
 * corto para mostrar en un mensaje, ej: "6h 32min".
 */
export function formatTimeUntilNextArgentinaMidnight(date: Date = new Date()): string {
    const { hours, minutes } = getTimeUntilNextArgentinaMidnight(date);
    return `${hours}h ${minutes}min`;
}
