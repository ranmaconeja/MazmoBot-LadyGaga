import { CommandHandler, RoomMessage, UserData } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { ModeratorsService } from '../services/moderators.service';
import { CooldownService, GLOBAL_COOLDOWN_KEY } from '../services/cooldown.service';

const COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 horas

/**
 * Cooldown GLOBAL (compartido por todo el canal, no por persona): máximo 1 uso
 * cada 3 horas entre TODOS los usuarios comunes — si Pepito lo usa, Jorgito
 * tiene que esperar el mismo cooldown, aunque nunca lo haya usado él. La
 * respuesta llega solo por privado a quien lo pidió. Moderadores/owner no
 * tienen límite de uso, y si lo piden ellos, la respuesta se publica en el
 * canal en vez de en privado.
 *
 * Además, un moderador puede usar !reglas @usuario para mandarle las reglas
 * por privado a ESA persona puntual (sin publicar nada en el canal) — sirve
 * para no tener que tirar el texto completo de las reglas en público cada
 * vez que hay que recordárselas a alguien. No hay restricción de que el
 * destinatario tenga que ser un usuario común: también funciona apuntando a
 * otro moderador, para poder probarlo sin depender de una cuenta de prueba.
 */
@Injectable()
export class ReglasHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly moderatorsService: ModeratorsService,
        private readonly cooldownService: CooldownService,
    ) {
    }

    getSignature(): string {
        return '!reglas';
    }

    /**
     * Extrae el identificador del usuario destino (mención real, ID numérico,
     * o username en texto), si se pasó alguno. Mismo mecanismo que !ban / !PuntosExtra.
     */
    private extractIdentifier(body: RoomMessage, message: string): string {
        const parts = message.split(' ').map(part => part.trim()).filter(Boolean);
        const mentions = (body.message.payload as any)?.userMentions;

        if (Array.isArray(mentions) && mentions.length >= 1) {
            const id = mentions[0]?.id ?? mentions[0]?.userId ?? mentions[0]?.user?.id;
            if (id !== undefined && id !== null) {
                return String(id);
            }
        }

        return parts[0] ?? '';
    }

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
        const isMod = this.moderatorsService.isModerator(authorId);

        // !reglas @usuario, solo para moderadores/owner: manda las reglas por
        // privado a ESA persona puntual, sin publicar nada en el canal
        const identifier = this.extractIdentifier(body, message);
        if (isMod && identifier) {
            const targetUser = await this.resolveUser(identifier);
            if (!targetUser) {
                await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('REGLAS_USUARIO_NO_ENCONTRADO'));
                return;
            }

            const text = this.messagesService.get('REGLAS');
            await this.botService.notifyUser(body.key, channelId, targetUser.id, text);
            return;
        }

        if (!isMod) {
            const minutosRestantes = await this.cooldownService.checkAndMark(GLOBAL_COOLDOWN_KEY, '!reglas', COOLDOWN_MS);
            if (minutosRestantes !== null) {
                const text = this.messagesService.get('COOLDOWN_ERROR', { MINUTOS: String(minutosRestantes) });
                await this.botService.notifyUser(body.key, channelId, authorId, text);
                return;
            }
        }

        const text = this.messagesService.get('REGLAS');
        if (isMod) {
            await this.botService.sendReply(body.key, channelId, text);
        } else {
            await this.botService.notifyUser(body.key, channelId, authorId, text);
        }
    }
}
