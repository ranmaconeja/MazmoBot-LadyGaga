import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { BanStatsRepository } from '../database/ban-stats.repository';
import { formatPejelagartos } from '../util/pejelagartos';

/**
 * Uso: !banranking (sin argumentos). Público y gratis.
 * Muestra el top 10 de moderadores por cantidad de bans ("Pejelagartos"),
 * según lo que va contando /new_ban (ver app.controller.ts → onNewBan).
 */
@Injectable()
export class BanRankingHandler implements CommandHandler {
    private readonly MEDALS = ['🥇', '🥈', '🥉'];

    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly banStatsRepository: BanStatsRepository,
    ) {
    }

    getSignature(): string {
        return '!banranking';
    }

    async handleCommand(req: Request, res: Response, message: string): Promise<void> {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;

        const ranking = await this.banStatsRepository.getRanking(10);
        if (!ranking.length) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('BAN_RANKING_VACIO'));
            return;
        }

        const lines = ranking.map((stat, i) => {
            const position = this.MEDALS[i] ?? `${i + 1}.`;
            const name = stat.username ? `@${stat.username}` : `ID ${stat.modId}`;
            return `${position} ${name}: ${formatPejelagartos(stat.count)}`;
        });

        const text = this.messagesService.get('BAN_RANKING', { RANKING: lines.join('\n') });
        await this.botService.sendReply(body.key, channelId, text);
    }
}
