import { CommandHandler, RoomMessage, UserData } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { PointsService } from '../services/points.service';
import { ModeratorsService } from '../services/moderators.service';

/**
 * Uso: !puntos (consulta el saldo propio) o !puntos @usuario (consulta el de otro).
 * Acepta @menciones reales, IDs numéricos, o usernames como texto plano para el
 * usuario objetivo, igual que !perfil.
 *
 * La respuesta llega solo por privado a quien lo pidió, salvo que quien lo pida
 * sea moderador/owner — en ese caso se publica en el canal.
 */
@Injectable()
export class PuntosHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly pointsService: PointsService,
        private readonly moderatorsService: ModeratorsService,
    ) {
    }

    getSignature(): string {
        return '!puntos';
    }

    /**
     * Resuelve el usuario objetivo: mención real, ID numérico, username en texto,
     * o quien escribió el comando si no se pasó ningún argumento.
     */
    private async resolveTargetUser(body: RoomMessage, argument: string): Promise<UserData | null> {
        const mentions = (body.message.payload as any)?.userMentions;
        if (Array.isArray(mentions) && mentions.length) {
            const mention = mentions[0];
            const mentionId = mention?.id ?? mention?.userId ?? mention?.user?.id;
            if (mentionId) {
                return this.botService.getUserData(Number(mentionId));
            }
        }

        const trimmed = argument.replace('@', '').trim();
        if (!trimmed) {
            return this.botService.getUserData(body.message.author.id);
        }
        if (!isNaN(Number(trimmed))) {
            return this.botService.getUserData(Number(trimmed));
        }
        return this.botService.getUserDataByUsername(trimmed);
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        const channelId = body.message.channel.id;
        const authorId = body.message.author.id;
        const isMod = this.moderatorsService.isModerator(authorId);

        // según quién PIDIÓ el comando (no de quién son los puntos consultados):
        // mod/owner -> se publica en el canal; usuario común -> solo por privado
        const reply = (text: string) => isMod
            ? this.botService.sendReply(body.key, channelId, text)
            : this.botService.notifyUser(body.key, channelId, authorId, text);

        const askedForOther = message.trim().length > 0;
        const targetUser = await this.resolveTargetUser(body, message);

        if (askedForOther && !targetUser) {
            await reply(this.messagesService.get('PUNTOS_USUARIO_NO_ENCONTRADO'));
            return;
        }

        const targetId = targetUser?.id ?? authorId;
        const isExempt = this.pointsService.isExempt(targetId);

        if (!askedForOther) {
            // sin argumento: mismo comportamiento de siempre, consulta sobre uno mismo
            if (isExempt) {
                await reply(this.messagesService.get('PUNTOS_EXENTO'));
                return;
            }
            const points = await this.pointsService.getPoints(targetId);
            const text = this.messagesService.get('PUNTOS', {
                POINTS: String(points),
                COST: String(this.pointsService.getCommandCost()),
            });
            await reply(text);
            return;
        }

        // con argumento: consulta sobre otro usuario
        const username = targetUser.username ?? String(targetId);
        if (isExempt) {
            await reply(this.messagesService.get('PUNTOS_OTRO_EXENTO', { USERNAME: username }));
            return;
        }
        const points = await this.pointsService.getPoints(targetId);
        const text = this.messagesService.get('PUNTOS_OTRO', {
            USERNAME: username,
            POINTS: String(points),
            COST: String(this.pointsService.getCommandCost()),
        });
        await reply(text);
    }
}
