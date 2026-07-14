import { Controller, Get, Headers, HttpException, Logger } from '@nestjs/common';
import { PlayerQueueService } from './modules/player/player-queue.service';

/**
 * Endpoint que polea el cliente de reproducción (programa de Windows) cada
 * tantos segundos, preguntando si hay una canción nueva para reproducir.
 *
 * No pasa por BotRequestMiddleware (ese valida el "bot-secret" que manda Mazmo,
 * una credencial distinta) — acá se valida "x-secret-key" contra PLAYER_SECRET_KEY,
 * igual que antes se validaba en la conexión WebSocket.
 */
@Controller('player')
export class PlayerController {
    private readonly logger = new Logger('PlayerPolling');

    constructor(private readonly playerQueueService: PlayerQueueService) {
    }

    @Get('next')
    async next(@Headers('x-secret-key') secretKey: string) {
        const expectedKey = process.env.PLAYER_SECRET_KEY;

        if (!expectedKey || secretKey !== expectedKey) {
            this.logger.warn('Poll rechazado: x-secret-key no coincide o PLAYER_SECRET_KEY no está configurada');
            throw new HttpException('Forbidden', 403);
        }

        await this.playerQueueService.registerPoll();
        const next = await this.playerQueueService.getNext();
        return next ?? { link: null };
    }
}
