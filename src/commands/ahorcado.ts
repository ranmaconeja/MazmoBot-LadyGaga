import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { HangmanService } from '../services/hangman.service';

/**
 * Uso: !suspension (sin argumentos). Arranca una partida nueva en el canal, si
 * no hay una en curso ya. Una vez arrancada, se juega escribiendo una letra
 * sola en el chat (sin !), o escribiendo la palabra completa directamente en
 * el chat (también sin !, sin penalidad si falla) — ver app.controller.ts.
 */
@Injectable()
export class AhorcadoHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly hangmanService: HangmanService,
    ) {
    }

    getSignature(): string {
        return '!suspension';
    }

    async handleCommand(req: Request, res: Response, message: string): Promise<void> {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const authorId = body.message.author.id;

        const existingGame = await this.hangmanService.getActiveGame(channelId);
        if (existingGame) {
            const text = this.messagesService.get('AHORCADO_YA_ACTIVO', {
                DIBUJO: this.hangmanService.drawHangman(existingGame.wrongCount),
                PALABRA: this.hangmanService.maskWord(existingGame),
            });
            await this.botService.sendReply(body.key, channelId, text);
            return;
        }

        const game = await this.hangmanService.startGame(channelId, String(authorId));
        if (!game) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('AHORCADO_SIN_PALABRAS'));
            return;
        }

        const text = this.messagesService.get('AHORCADO_INICIO', {
            DIBUJO: this.hangmanService.drawHangman(0),
            PALABRA: this.hangmanService.maskWord(game),
        });
        await this.botService.sendReply(body.key, channelId, text);
    }
}
