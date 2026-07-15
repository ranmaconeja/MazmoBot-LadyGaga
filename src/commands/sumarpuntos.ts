import { CommandHandler, RoomMessage, UserData } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { ModeratorsService } from '../services/moderators.service';
import { PointsService } from '../services/points.service';

/**
 * Uso: !addPuntos @usuario <cantidad>
 * Solo moderadores y el owner del bot (ver ModeratorsService) pueden usar este comando.
 * Acepta @menciones reales, IDs numéricos, o usernames como texto plano.
 */
@Injectable()
export class SumarPuntosHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly moderatorsService: ModeratorsService,
        private readonly pointsService: PointsService,
    ) {
    }

    getSignature(): string {
        return '!addPuntos';
    }

    /**
     * Extrae el identificador del usuario objetivo (mención real, ID numérico o username
     * en texto) y la cantidad a sumar de las palabras del mensaje.
     */
    private extractArgs(body: RoomMessage, message: string): { identifier: string, amountRaw: string } {
        const parts = message.split(' ').map(part => part.trim()).filter(Boolean);
        const mentions = (body.message.payload as any)?.userMentions;

        if (Array.isArray(mentions) && mentions.length >= 1) {
            const id = mentions[0]?.id ?? mentions[0]?.userId ?? mentions[0]?.user?.id;
            if (id !== undefined && id !== null) {
                // la cantidad es el último token del mensaje (para no depender de cómo
                // Mazmo represente la mención dentro del texto plano)
                return { identifier: String(id), amountRaw: parts[parts.length - 1] };
            }
        }

        return { identifier: parts[0], amountRaw: parts[1] };
    }

    /**
     * Resuelve un identificador (ID numérico, @username o username sin @) a los datos
     * completos del usuario, en una sola llamada a la API de Mazmo (antes se pedía acá
     * solo para sacar el id, y se volvía a pedir en handleCommand para sacar el username).
     */
    private async resolveUser(identifier: string): Promise<UserData | null> {
        const cleanId = identifier.replace('@', '').trim();
        if (!cleanId) {
            return null;
        }
        if (!isNaN(Number(cleanId))) {
            return this.botService.getUserData(Number(cleanId));
        }
        return this.botService.getUserDataByUsername(cleanId);
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const authorId = body.message.author.id;

        if (!this.moderatorsService.isModerator(authorId)) {
            await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('NOT_MODERATOR'));
            return;
        }

        const { identifier, amountRaw } = this.extractArgs(body, message);
        const amount = Number(amountRaw);

        if (!identifier || !amountRaw || isNaN(amount) || !Number.isInteger(amount) || amount <= 0) {
            await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('SUMARPUNTOS_USAGE'));
            return;
        }

        const targetUser = await this.resolveUser(identifier);
        if (targetUser === null) {
            await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('SUMARPUNTOS_ERROR'));
            return;
        }

        const username = targetUser.username ?? String(targetUser.id);
        const newTotal = await this.pointsService.addPointsManually(targetUser.id, amount);

        await this.botService.sendReply(body.key, channelId, this.messagesService.get('SUMARPUNTOS_OK', {
            USERNAME: username,
            AMOUNT: String(amount),
            TOTAL: String(newTotal),
        }));
    }
}
