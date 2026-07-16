import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { FactService } from '../modules/ai/fact.service';
import { FactRepository } from '../database/fact.repository';

/**
 * Uso: !dato (sin argumentos).
 * Le pide a la IA un dato curioso sobre el mundo Femdom/BDSM (histórico,
 * cultural, cine/música, curiosidad práctica, etc. — ver fact.service.ts),
 * pasándole los últimos datos ya usados para que no repita siempre lo mismo.
 */
@Injectable()
export class DatoHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly factService: FactService,
        private readonly factRepository: FactRepository,
    ) {
    }

    getSignature(): string {
        return '!dato';
    }

    async handleCommand(req: Request, res: Response, message: string): Promise<void> {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;

        const previousFacts = await this.factRepository.getRecent();
        const fact = await this.factService.getFact(previousFacts);
        if (!fact) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('DATO_IA_ERROR'));
            return;
        }

        await this.factRepository.save(fact);

        const text = this.messagesService.get('DATO_RESULT', { DATO: fact });
        await this.botService.sendReply(body.key, channelId, text);
    }
}
