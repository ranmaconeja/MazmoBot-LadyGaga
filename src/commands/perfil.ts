import { CommandHandler, RoomMessage, UserData } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { TagsService } from '../services/tags.service';
import { ModeratorsService } from '../services/moderators.service';
import { parseMentions } from '../util/mentions';

@Injectable()
export class PerfilHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly tagsService: TagsService,
        private readonly moderatorsService: ModeratorsService,
    ) {
    }

    getSignature(): string {
        return '!perfil';
    }

    /**
     * Resuelve el usuario objetivo:
     * - "!perfil @alguien" seleccionado del popup de mazmo -> usa userMentions
     * - "!perfil 41002" -> ID numérico directo
     * - "!perfil alguien" o "!perfil @alguien" como texto plano -> busca por username
     * - "!perfil" (sin argumento) -> quien escribió el comando
     */
    private async resolveTargetUser(body: RoomMessage, argument: string): Promise<UserData> {
        // las menciones vienen en el HTML del rawContent (<mazmo-user
        // username="...">), no en userMentions (siempre vacío). Ver
        // util/mentions.ts. Resolvemos por username, que sí funciona.
        const mentions = parseMentions(body.message.payload.rawContent);
        if (mentions.length && mentions[0].username) {
            return this.botService.getUserDataByUsername(mentions[0].username);
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
        const user = await this.resolveTargetUser(body, message);
        const channelId = body.message.channel.id;

        if (!user) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('PERFIL_ERROR'));
            return;
        }

        // el ID numérico (el mismo que se usa en config/moderadores.txt) solo se
        // muestra si quien PIDE el !perfil es moderador/owner, no al usuario común
        const isRequesterMod = this.moderatorsService.isModerator(body.message.author.id);
        const idLine = isRequesterMod ? `\nID (solo mods): ${user.id}` : '';

        const text = this.messagesService.get('PERFIL', {
            USERNAME: user.username ?? 'desconocido',
            DISPLAYNAME: user.displayname ?? '-',
            COUNTRY: user.region?.name ? `${user.region.name}, ${user.country?.name ?? '-'}` : (user.country?.name ?? '-'),
            GENERO: user.gender ?? '-',
            REGDATE: user.regdate ?? '-',
            TAGS: (user.tags && user.tags.length) ? this.tagsService.translateAll(user.tags).join(', ') : '(sin etiquetas)',
            ME_CONOCEN: String(user.knowedCount ?? 0),
            EVENTOS: String(user.eventCount ?? 0),
            ID_LINE: idLine,
        });

        if (isRequesterMod) {
            // el ID es información sensible/interna, así que si la incluimos, la mandamos
            // en privado (solo la ve quien pidió el comando), no al canal completo
            await this.botService.notifyUser(body.key, channelId, body.message.author.id, text);
        } else {
            await this.botService.sendReply(body.key, channelId, text);
        }
    }
}
