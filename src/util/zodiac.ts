/**
 * Calcula el signo zodiacal occidental a partir de una fecha (mes/día),
 * usando los rangos tradicionales. Se usa sobre la fecha de registro del
 * usuario en Mazmo (no su fecha de nacimiento real) para el "Signo Zodiacal
 * Mazmorrero" de !compatibilidadastral.
 */
export function getZodiacSign(date: Date): string {
    const month = date.getUTCMonth() + 1; // 1-12
    const day = date.getUTCDate();

    const ranges: { sign: string, startMonth: number, startDay: number, endMonth: number, endDay: number }[] = [
        { sign: 'Aries', startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
        { sign: 'Tauro', startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
        { sign: 'Géminis', startMonth: 5, startDay: 21, endMonth: 6, endDay: 20 },
        { sign: 'Cáncer', startMonth: 6, startDay: 21, endMonth: 7, endDay: 22 },
        { sign: 'Leo', startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
        { sign: 'Virgo', startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
        { sign: 'Libra', startMonth: 9, startDay: 23, endMonth: 10, endDay: 22 },
        { sign: 'Escorpio', startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
        { sign: 'Sagitario', startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 },
        { sign: 'Piscis', startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 },
    ];

    for (const range of ranges) {
        if (
            (month === range.startMonth && day >= range.startDay) ||
            (month === range.endMonth && day <= range.endDay)
        ) {
            return range.sign;
        }
    }

    // Capricornio y Acuario cruzan el fin de año, se manejan aparte
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) {
        return 'Capricornio';
    }
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) {
        return 'Acuario';
    }

    return 'Ofiuco'; // no debería llegar acá, pero por las dudas
}
