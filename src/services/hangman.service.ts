import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { resolveConfigPath } from '../util/config-path';
import { HangmanGame, HangmanRepository } from '../database/hangman.repository';

export type GuessResult = {
    game: HangmanGame,
    alreadyGuessed: boolean,
    correct: boolean,
    won: boolean,
    lost: boolean,
};

const MAX_WRONG = 10;

// dibujo clásico del ahorcado, una entrada por cantidad de fallos (0 a 6)
const HANGMAN_STAGES = [
    '  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========',
];

@Injectable()
export class HangmanService {
    private readonly logger = new Logger('HangmanService');
    private words: string[] = [];

    constructor(private readonly hangmanRepository: HangmanRepository) {
        this.load();
    }

    private load() {
        const wordsPath = resolveConfigPath('ahorcado-palabras.json');
        try {
            const raw = fs.readFileSync(wordsPath, 'utf-8');
            const parsed = JSON.parse(raw);
            this.words = Array.isArray(parsed.palabras) ? parsed.palabras : [];
        } catch (e) {
            this.logger.warn('No se pudo cargar config/ahorcado-palabras.json');
            this.words = [];
        }
    }

    /**
     * Saca acentos y pasa a minúscula, para comparar sin importar tildes
     * (mismo criterio que el resto del bot, que ya avisa que "no reconoce acentos").
     */
    private normalize(text: string): string {
        return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    async startGame(channelId: string, startedBy: string): Promise<HangmanGame | null> {
        if (!this.words.length) {
            return null;
        }

        const recentWords = await this.hangmanRepository.getRecentWords();
        const recentNormalized = recentWords.map(w => this.normalize(w));

        const available = this.words.filter(w => !recentNormalized.includes(this.normalize(w)));
        const pool = available.length ? available : this.words;
        const word = pool[Math.floor(Math.random() * pool.length)];

        await this.hangmanRepository.createGame(channelId, word, startedBy);
        return this.hangmanRepository.getActiveGame(channelId);
    }

    async getActiveGame(channelId: string): Promise<HangmanGame | null> {
        return this.hangmanRepository.getActiveGame(channelId);
    }

    async endGame(channelId: string): Promise<void> {
        await this.hangmanRepository.endGame(channelId);
    }

    /**
     * Procesa el intento de adivinar UNA letra.
     */
    async guessLetter(game: HangmanGame, rawLetter: string): Promise<GuessResult> {
        const letter = this.normalize(rawLetter);
        const normalizedWord = this.normalize(game.word);

        if (game.guessedLetters.includes(letter) || game.wrongLetters.includes(letter)) {
            return { game, alreadyGuessed: true, correct: false, won: false, lost: false };
        }

        const isCorrect = normalizedWord.includes(letter);
        const guessedLetters = isCorrect ? [...game.guessedLetters, letter] : game.guessedLetters;
        const wrongLetters = isCorrect ? game.wrongLetters : [...game.wrongLetters, letter];
        const wrongCount = isCorrect ? game.wrongCount : game.wrongCount + 1;

        const updatedGame: HangmanGame = { ...game, guessedLetters, wrongLetters, wrongCount };
        const won = this.isWordComplete(updatedGame);
        const lost = !won && wrongCount >= MAX_WRONG;

        if (won || lost) {
            await this.hangmanRepository.endGame(game.channelId);
        } else {
            await this.hangmanRepository.updateGame(game.channelId, guessedLetters, wrongLetters, wrongCount);
        }

        return { game: updatedGame, alreadyGuessed: false, correct: isCorrect, won, lost };
    }

    /**
     * Chequeo silencioso (sin penalidad) de si un texto cualquiera coincide
     * con la palabra secreta. Para la detección pasiva: cualquier mensaje
     * que la acierte gana, pero si NO coincide no pasa nada — no cuenta como
     * error ni genera ningún mensaje, para no interferir con la charla normal.
     */
    isWordMatch(game: HangmanGame, text: string): boolean {
        return this.normalize(text) === this.normalize(game.word);
    }

    /**
     * Cierra el juego como ganado por adivinar la palabra completa (sin
     * ninguna penalidad — ver isWordMatch()).
     */
    async winByWord(game: HangmanGame): Promise<HangmanGame> {
        await this.hangmanRepository.endGame(game.channelId);
        const allLetters = Array.from(new Set(this.normalize(game.word).split('').filter(c => /[a-z]/.test(c))));
        return { ...game, guessedLetters: allLetters };
    }

    private isWordComplete(game: HangmanGame): boolean {
        const normalizedWord = this.normalize(game.word);
        return normalizedWord.split('').every(char => !/[a-z]/.test(char) || game.guessedLetters.includes(char));
    }

    /**
     * Arma la palabra enmascarada, ej: "_ o _ i n a n t e" para "dominante"
     * con la "o" y la "n" ya adivinadas — se muestra la letra original (con
     * su acento real) aunque la comparación interna la ignore.
     */
    maskWord(game: HangmanGame): string {
        return game.word
            .split('')
            .map(char => {
                if (char === ' ') {
                    // un espacio real, sin marcar, es fácil que el chat lo
                    // colapse junto con los espacios que separan cada letra
                    // (el .join(' ') de abajo), y las dos palabras terminan
                    // pareciendo una sola pegada — se marca con "/" para que
                    // se note siempre, colapse lo que colapse
                    return '/';
                }
                const normalizedChar = this.normalize(char);
                if (!/[a-z]/.test(normalizedChar)) {
                    return char; // guiones, signos, etc. se muestran siempre
                }
                return game.guessedLetters.includes(normalizedChar) ? char : '_';
            })
            .join(' ');
    }

    drawHangman(wrongCount: number): string {
        // el dibujo tiene 7 etapas (0 a 6) aunque MAX_WRONG sea más alto — a
        // partir de la etapa 6 (figura completa) se reutiliza la misma
        // imagen, no hace falta dibujar más para los intentos 7 a 10
        const stage = Math.min(wrongCount, HANGMAN_STAGES.length - 1);
        return HANGMAN_STAGES[stage];
    }

    getMaxWrong(): number {
        return MAX_WRONG;
    }
}
