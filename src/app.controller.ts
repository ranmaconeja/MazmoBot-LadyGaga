import { Body, Controller, Get, HttpException, Logger, NotFoundException, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AnyDict, RoomMessage, SadesReceivedTransaction } from './types';
import { CommandService } from './services/command.service';
import { BotService } from './services/bot.service';
import { WelcomeService } from './modules/welcome/welcome.service';
import { AutofrasesService } from './modules/autofrases/autofrases.service';
import { YoutubeService } from './modules/youtube/youtube.service';
import { MessagesService } from './services/messages.service';
import { ExpulsionGifService } from './services/expulsion-gif.service';
import { RandomMentionService } from './services/random-mention.service';
import { stripHtml } from './util/sanitize';

@Controller()
export class AppController {
    private readonly logger = new Logger('IncomingMessage');

    constructor(
        private readonly botService: BotService,
        private commandService: CommandService,
        private welcomeService: WelcomeService,
        private autofrasesService: AutofrasesService,
        private youtubeService: YoutubeService,
        private messagesService: MessagesService,
        private expulsionGifService: ExpulsionGifService,
        private randomMentionService: RandomMentionService,
    ) {
    }

    /**
     * Endpoint ejecutado al recibir mensaje de la sala, incluye la lógica necesaria para ejecutar los
     * commandHandlers registrados en el constructor
     */
    @Post('message')
    async onRoomMessage(@Body() body: RoomMessage, @Req() req: Request, @Res() res: Response) {
        const rawContent = stripHtml(body.message.payload.rawContent);
        this.logger.log(`Mensaje recibido: "${rawContent}" (autor id: ${body.message.author.id}, canal: ${body.message.channel.id})`);

        // log temporal de diagnóstico: para ver la estructura real de las menciones que manda mazmo
        if (rawContent.startsWith('!lazo') || rawContent.startsWith('!astral') || rawContent.startsWith('!perfil')) {
            this.logger.debug(`Payload completo del mensaje: ${JSON.stringify(body.message.payload)}`);
        }

        if (! await this.commandService.handle(rawContent, req, res)) {
            // no se ha encontrado coincidencia para un comando registrado

            // chequeamos si el mensaje dispara alguna autofrase por palabra clave
            const autoResponse = this.autofrasesService.checkMessage(rawContent);
            if (autoResponse) {
                await this.botService.sendReply(body.key, body.message.channel.id, autoResponse);
            }

            // si el mensaje contiene la palabra "quien" (sola, no "quienes" ni
            // "aquien"), mencionamos a un participante al azar del canal
            if (/\bquien\b/i.test(rawContent)) {
                const username = await this.randomMentionService.pickRandomParticipant(body);
                if (username) {
                    const text = this.messagesService.get('QUIEN_RESPUESTA', { USERNAME: username });
                    await this.botService.sendReply(body.key, body.message.channel.id, text);
                }
            }
        }

        // independientemente de si era un comando o no, si el mensaje trae un link de YouTube
        // publicamos el título, descripción y miniatura del video
        const videoId = this.youtubeService.extractVideoId(rawContent);
        if (videoId) {
            const videoInfo = await this.youtubeService.getVideoInfo(videoId);
            if (videoInfo) {
                const text = this.messagesService.get('YOUTUBE_INFO', {
                    TITLE: videoInfo.title,
                    DESCRIPTION: videoInfo.description,
                    THUMBNAIL_URL: videoInfo.thumbnailUrl,
                });
                await this.botService.sendReply(body.key, body.message.channel.id, text);
            }
        }

        res.status(200).send('OK')
    }


    /**
     *  Endpoint ejecutado al recibir una transferencia de sades entrante.
     *  No menciona al usuario por username (evita depender de getUserData, que
     *  puede devolver null si la API de Mazmo falla justo en ese momento).
     */
    @Post('sades_received')
    async onSadesReceived(@Body() body: SadesReceivedTransaction, @Req() req: Request, @Res() res: Response) {
        await this.botService.sendReply(body.transaction.data.replyKey, body.transaction.data.channelId, `Gracias por tu infinita generosidad!`);
        res.status(200).send('OK')
    }


    /**
     *  Endpoint ejecutado al ingresar un nuevo usuario en la sala
     */
    @Post('user_enter')
    async onUserEnter(@Body() body: RoomMessage, @Req() req: Request, @Res() res: Response) {
        await this.welcomeService.welcomeUser(body)
        res.status(200).send('OK')
    }

    /**
     *  Endpoint ejecutado al salir un usuario de la sala
     */
    @Post('user_leave')
    async onUserLeave(@Body() body: RoomMessage, @Req() req: Request, @Res() res: Response) {
        res.status(200).send('OK')
    }

    /**
     *  Endpoint ejecutado al banear un usuario en la sala.
     *
     *  La forma exacta del payload que manda Mazmo acá NUNCA se confirmó
     *  (el tipo RoomMessage es un supuesto heredado de la plantilla original
     *  del bot, no algo verificado para este evento puntual) — por eso se
     *  loguea el body crudo completo, y se prueban varios nombres de campo
     *  posibles para channelId/key antes de rendirse. Si en producción no
     *  postea el GIF, hay que mirar el log "onNewBan: body crudo recibido"
     *  en Vercel para ver la forma real y ajustar la extracción de abajo.
     */
    @Post('new_ban')
    async onNewBan(@Body() body: AnyDict, @Req() req: Request, @Res() res: Response) {
        this.logger.debug(`onNewBan: body crudo recibido: ${JSON.stringify(body)}`);

        try {
            const channelId = body?.message?.channel?.id ?? body?.channel?.id ?? body?.channelId;
            const replyKey = body?.key ?? body?.replyKey;

            if (!channelId || !replyKey) {
                this.logger.warn(`onNewBan: no se pudo extraer channelId/key del payload, no se publica el GIF (channelId=${channelId}, replyKey=${replyKey})`);
                res.status(200).send('OK');
                return;
            }

            const gifUrl = this.expulsionGifService.getRandomGif();
            if (!gifUrl) {
                this.logger.warn('onNewBan: no hay GIFs configurados en config/gifs-expulsion.json');
                res.status(200).send('OK');
                return;
            }

            const text = this.messagesService.get('EXPULSION_GIF', { GIF_URL: gifUrl });
            await this.botService.sendReply(replyKey, channelId, text);
        } catch (e) {
            this.logger.error('onNewBan: error inesperado al procesar el ban: ' + e.message);
        }

        res.status(200).send('OK')
    }

    /**
     *  Endpoint ejecutado al actualizar la información del canal (se dispara cuando se remueve un baneo)
     */
    @Post('channel_updated')
    async onChannelUpdated(@Body() body: RoomMessage, @Req() req: Request, @Res() res: Response) {
        res.status(200).send('OK')
    }

    /**
     *  Endpoint ejecutado al editar un mensaje
     *  Nota: at the time of this writing este evento no es disparado por el backend de mazmo
     */
    @Post('message_updated')
    async onMessageUpdated(@Body() body: AnyDict, @Req() req: Request, @Res() res: Response) {
        // @TODO: to implement
        res.status(200).send('OK')
    }

    /**
     *  Endpoint ejecutado al agregar una reacción
     *  Nota: at the time of this writing este evento no es disparado por el backend de mazmo
     */
    @Post('reaction_added')
    async onReactionAdded(@Body() body: AnyDict, @Req() req: Request, @Res() res: Response) {
        // @TODO: to implement
        res.status(200).send('OK')
    }

    /**
     *  Endpoint ejecutado al quitar una reacción
     *  Nota: at the time of this writing este evento no es disparado por el backend de mazmo
     */
    @Post('reaction_removed')
    async onReactionRemoved(@Body() body: AnyDict, @Req() req: Request, @Res() res: Response) {
        // @TODO: to implement
        res.status(200).send('OK')
    }


    /**
     * Ruta por defecto
     */
    @Post('*')
    defaultRoute(@Body() body: any, @Req() req: Request, @Res() res: Response) {
        throw new NotFoundException()
    }
}
