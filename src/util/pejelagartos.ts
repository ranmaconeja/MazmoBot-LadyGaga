/** "1 Pejelagarto" / "12 Pejelagartos" para el contador y el ranking de bans. */
export function formatPejelagartos(count: number): string {
    return count === 1 ? '1 Pejelagarto' : `${count} Pejelagartos`;
}
