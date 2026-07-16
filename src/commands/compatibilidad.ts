import { CommandHandler, RoomMessage, UserData } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { MessagesService } from '../services/messages.service';
import { CompatibilityService } from '../modules/ai/compatibility.service';

/**
 * Uso: !lazo usuario1 usuario2
 * Acepta: @menciones reales (seleccionadas del popup de Mazmo), IDs numéricos, o usernames como texto plano.
 * Le pide a la IA (Gemini) un % de compatibilidad entre los dos perfiles según sus etiquetas.
 */
@Injectable()
export class CompatibilidadHandler implements CommandHandler {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
        private readonly compatibilityService: CompatibilityService,
    ) {
    }

    getSignature(): string {
        return '!lazo';
    }

    /**
     * Extrae los dos identificadores de usuario (mención real, ID numérico, o username en texto)
     * de las palabras del mensaje, ignorando palabras vacías.
     */
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

    /**
     * Resuelve un identificador (ID numérico, @username o username sin @) a los datos del usuario.
     */
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
        const [identifier1, identifier2] = this.extractIdentifiers(body, message);

        if (!identifier1 || !identifier2) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('COMPATIBILIDAD_USAGE'));
            return;
        }

        const [user1, user2] = await Promise.all([
            this.resolveUser(identifier1),
            this.resolveUser(identifier2),
        ]);

        if (!user1 || !user2) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('COMPATIBILIDAD_ERROR'));
            return;
        }

        const result = await this.compatibilityService.getCompatibility(user1, user2);
        if (!result) {
            await this.botService.sendReply(body.key, channelId, this.messagesService.get('COMPATIBILIDAD_IA_ERROR'));
            return;
        }

        const text = this.messagesService.get('COMPATIBILIDAD_RESULT', {
            USERNAME1: user1.username ?? identifier1,
            USERNAME2: user2.username ?? identifier2,
            PORCENTAJE: String(result.porcentaje),
            DESCRIPCION: result.descripcion,
        });

        await this.botService.sendReply(body.key, channelId, text);
    }
}
