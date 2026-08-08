import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { HangmanService } from '../services/hangman.service';
import { PointsService } from '../services/points.service';

// puntos de premio a quien complete la palabra (por letra o de una)
const PREMIO_PUNTOS = 10;

/**
 * Uso: !palabra <palabra completa> — arriesga la palabra entera del !ahorcado
 * activo. Si falla, cuenta como un error más (igual que fallar una letra).
 */
@Injectable()
export class PalabraHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly hangmanService: HangmanService,
        private readonly pointsService: PointsService,
    ) {
    }

    getSignature(): string {
        return '!palabra';
    }

    async handleCommand(req: Request, res: Response, message: string): Promise<void> {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const authorId = body.message.author.id;

        const guess = message.trim();
        if (!guess) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('AHORCADO_PALABRA_USAGE'));
            return;
        }

        const game = await this.hangmanService.getActiveGame(channelId);
        if (!game) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('AHORCADO_SIN_JUEGO'));
            return;
        }

        const result = await this.hangmanService.guessWord(game, guess);

        if (result.won) {
            await this.pointsService.addPointsManually(authorId, PREMIO_PUNTOS);
            const text = this.messagesService.get('AHORCADO_GANADO', {
                PALABRA: result.game.word,
                PUNTOS: String(PREMIO_PUNTOS),
            });
            await this.botService.sendReply(body.key, channelId, text);
            return;
        }

        if (result.lost) {
            const text = this.messagesService.get('AHORCADO_PERDIDO', {
                DIBUJO: this.hangmanService.drawHangman(result.game.wrongCount),
                PALABRA: result.game.word,
            });
            await this.botService.sendReply(body.key, channelId, text);
            return;
        }

        const text = this.messagesService.get('AHORCADO_PALABRA_INCORRECTA', {
            DIBUJO: this.hangmanService.drawHangman(result.game.wrongCount),
            PALABRA: this.hangmanService.maskWord(result.game),
            RESTANTES: String(this.hangmanService.getMaxWrong() - result.game.wrongCount),
        });
        await this.botService.sendReply(body.key, channelId, text);
    }
}
