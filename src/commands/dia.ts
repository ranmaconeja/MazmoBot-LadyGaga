import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { QuestionOfDayService } from '../modules/ai/question-of-day.service';
import { QuestionOfDayRepository } from '../database/question-of-day.repository';
import { getArgentinaDateString, formatTimeUntilNextArgentinaMidnight } from '../util/argentina-date';

/**
 * Uso: !dia (sin argumentos).
 * Muestra la "pregunta del día": si ya se generó una para la fecha de hoy
 * (calendario argentino, UTC-3), la reutiliza tal cual sin volver a llamar a
 * la IA; si todavía no hay ninguna para hoy, le pide una nueva a la IA y la
 * guarda en Turso. A las 00:00 hora argentina cambia la fecha, así que el
 * primer !dia después de medianoche genera una pregunta nueva, que se
 * mantiene fija el resto del día.
 */
@Injectable()
export class DiaHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly questionOfDayService: QuestionOfDayService,
        private readonly questionOfDayRepository: QuestionOfDayRepository,
    ) {
    }

    getSignature(): string {
        return '!dia';
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const today = getArgentinaDateString();

        let question = await this.questionOfDayRepository.getForDate(today);

        if (!question) {
            const previousQuestions = await this.questionOfDayRepository.getRecentQuestions();
            const generated = await this.questionOfDayService.generateQuestion(previousQuestions);
            if (!generated) {
                await this.botService.sendReply(body.key, channelId, this.messagesService.get('DIA_IA_ERROR'));
                return;
            }
            await this.questionOfDayRepository.save(today, generated);
            question = generated;
        }

        const tiempoRestante = formatTimeUntilNextArgentinaMidnight();
        const text = this.messagesService.get('DIA_RESULT', { PREGUNTA: question, TIEMPO_RESTANTE: tiempoRestante });
        await this.botService.sendReply(body.key, channelId, text);
    }
}
