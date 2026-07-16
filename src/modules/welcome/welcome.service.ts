import { Injectable } from '@nestjs/common';
import { BotService } from '../../services/bot.service';
import { MessagesService } from '../../services/messages.service';
import { RoomMessage } from '../../types';

@Injectable()
export class WelcomeService {
    constructor(
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
    ) {
    }

    /**
     * Envía el mensaje de bienvenida a un usuario que acaba de ingresar al canal.
     */
    async welcomeUser(body: RoomMessage) {
        const text = this.messagesService.get('BIENVENIDA');
        await this.botService.notifyUser(body.key, body.message.channel.id, body.message.author.id, text);
    }
}
