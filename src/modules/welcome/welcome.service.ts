import { Injectable } from '@nestjs/common';
import { BotService } from '../../services/bot.service';
import { MessagesService } from '../../services/messages.service';

@Injectable()
export class WelcomeService {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
    ) {
    }

    /**
     * Envía el mensaje de bienvenida (bloque [BIENVENIDA]) por privado a un usuario.
     *
     * 22/09/2026: antes recibía el body entero con el formato viejo de bots
     * (body.key, body.message.channel.id, body.message.author.id), que con la
     * cuenta de Organización llegaba undefined en /user_enter. Ahora recibe
     * los IDs ya extraídos, y cada caller se encarga de sacarlos de su payload.
     * replyKey vacío: ya no se usa, autentica con MAZMO_ORG_TOKEN (bot.service.ts).
     */
    async welcomeUser(channelId: number | string, userId: number | string) {
        const text = this.messagesService.get('BIENVENIDA');
        await this.botService.notifyUser('', String(channelId), Number(userId), text);
    }
}
