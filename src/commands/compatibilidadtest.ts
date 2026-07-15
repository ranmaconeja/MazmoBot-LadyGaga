import { CommandHandler, RoomMessage, UserData } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { CompatibilityService } from '../modules/ai/compatibility.service';

/**
 * Clon de !lazo para pruebas: SOLO lo puede usar el Owner del bot
 * (OWNER_ID en el .env) y el resultado le llega en privado a él, nunca se
 * publica en el canal — útil para probar ajustes del prompt sin que el
 * resto del canal vea los resultados de prueba.
 */
@Injectable()
export class CompatibilidadTestHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly compatibilityService: CompatibilityService,
    ) {
    }

    getSignature(): string {
        return '!lazotest';
    }

    private extractIdentifiers(body: RoomMessage, message: string): string[] {
        const mentions = (body.message.payload as any)?.userMentions;
        if (Array.isArray(mentions) && mentions.length >= 2) {
            const ids = mentions.slice(0, 2).map((m: any) => String(m?.id ?? m?.userId ?? m?.user?.id ?? '')).filter(Boolean);
            if (ids.length === 2) {
                return ids;
            }
        }

        return message.split(' ').map(part => part.trim()).filter(Boolean).slice(0, 2);
    }

    private async resolveUser(identifier: string): Promise<UserData> {
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

        // solo el Owner puede usar este comando, ni siquiera el resto de los moderadores.
        // No respondemos nada en absoluto si alguien más lo intenta, para no delatar
        // que existe este comando de prueba.
        if (String(authorId) !== process.env.OWNER_ID) {
            return;
        }

        const [identifier1, identifier2] = this.extractIdentifiers(body, message);

        if (!identifier1 || !identifier2) {
            await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('COMPATIBILIDAD_USAGE'));
            return;
        }

        const [user1, user2] = await Promise.all([
            this.resolveUser(identifier1),
            this.resolveUser(identifier2),
        ]);

        if (!user1 || !user2) {
            await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('COMPATIBILIDAD_ERROR'));
            return;
        }

        const result = await this.compatibilityService.getCompatibility(user1, user2);
        if (!result) {
            await this.botService.notifyUser(body.key, channelId, authorId, this.messagesService.get('COMPATIBILIDAD_IA_ERROR'));
            return;
        }

        const text = this.messagesService.get('COMPATIBILIDAD_RESULT', {
            USERNAME1: user1.username ?? identifier1,
            USERNAME2: user2.username ?? identifier2,
            PORCENTAJE: String(result.porcentaje),
            DESCRIPCION: result.descripcion,
        });

        // notifyUser en vez de sendReply: el resultado solo lo ve el Owner, nunca se publica
        await this.botService.notifyUser(body.key, channelId, authorId, text);
    }
}
