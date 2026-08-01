import { CommandHandler, RoomMessage, UserData } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { ModeratorsService } from '../services/moderators.service';

/**
 * Uso: !ban @usuario [motivo opcional]
 * Solo moderadores y el owner del bot (ver ModeratorsService) pueden usar este comando.
 * Acepta @menciones reales, IDs numéricos, o usernames como texto plano.
 *
 * Llama de verdad a la API de Mazmo (BotService.banUser) — no es solo un
 * aviso, expulsa al usuario del canal. No hay confirmación de por medio,
 * usalo con cuidado.
 */
@Injectable()
export class BanHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly moderatorsService: ModeratorsService,
    ) {
    }

    getSignature(): string {
        return '!ban';
    }

    /**
     * Extrae el identificador del usuario a banear y el motivo (el resto del
     * mensaje) de las palabras del mensaje. Mismo mecanismo que !PuntosExtra.
     */
    private extractArgs(body: RoomMessage, message: string): { identifier: string, reason: string } {
        const parts = message.split(' ').map(part => part.trim()).filter(Boolean);
        const mentions = (body.message.payload as any)?.userMentions;

        if (Array.isArray(mentions) && mentions.length >= 1) {
            const id = mentions[0]?.id ?? mentions[0]?.userId ?? mentions[0]?.user?.id;
            if (id !== undefined && id !== null) {
                // el motivo es todo lo que sigue después del primer token
                // (no depende de cómo Mazmo represente la mención en el texto plano)
                return { identifier: String(id), reason: parts.slice(1).join(' ') };
            }
        }

        return { identifier: parts[0] ?? '', reason: parts.slice(1).join(' ') };
    }

    /**
     * Resuelve un identificador (ID numérico, @username o username sin @) a
     * los datos del usuario. Mismo patrón que !PuntosExtra / !lazo.
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

        const { identifier, reason } = this.extractArgs(body, message);
        if (!identifier) {
            await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('BAN_USAGE'));
            return;
        }

        const targetUser = await this.resolveUser(identifier);
        if (!targetUser) {
            await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('BAN_ERROR'));
            return;
        }

        const success = await this.botService.banUser(body.key, channelId, targetUser.id, reason || undefined);
        const username = targetUser.username ?? String(targetUser.id);

        if (!success) {
            await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('BAN_FALLIDO', { USERNAME: username }));
            return;
        }

        await this.botService.sendReply(body.key, channelId, this.messagesService.get('BAN_OK', { USERNAME: username }));
    }
}
