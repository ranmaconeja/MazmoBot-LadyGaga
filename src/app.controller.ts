import { Body, Controller, Get, HttpException, Logger, NotFoundException, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AnyDict, RoomMessage, SadesReceivedTransaction } from './types';
import { CommandService } from './services/command.service';
import { BotService } from './services/bot.service';
import { WelcomeService } from './modules/welcome/welcome.service';
import { AutofrasesService } from './modules/autofrases/autofrases.service';
import { YoutubeService } from './modules/youtube/youtube.service';
import { MessagesService } from './services/messages.service';
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

        // log temporal de diagnóstico: para ver la estructura real de las menciones que manda mazmo.
        // Se usa .log() (no .debug()) para asegurar que aparezca en los logs de Vercel en produccion.
        if (rawContent.startsWith('!lazo') || rawContent.startsWith('!astral') || rawContent.startsWith('!perfil') || rawContent.startsWith('!radio')) {
            this.logger.log(`DIAG rawContent CRUDO (sin stripHtml): ${JSON.stringify(body.message.payload.rawContent)}`);
            this.logger.log(`DIAG payload completo: ${JSON.stringify(body.message.payload)}`);
        }

        if (! await this.commandService.handle(rawContent, req, res)) {
            // no se ha encontrado coincidencia para un comando registrado

            // chequeamos si el mensaje dispara alguna autofrase por palabra clave
            const autoResponse = this.autofrasesService.checkMessage(rawContent);
            if (autoResponse) {
                await this.botService.sendReply(body.key, body.message.channel.id, autoResponse);
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
     *  Endpoint ejecutado al banear un usuario en la sala
     */
    @Post('new_ban')
    async onNewBan(@Body() body: RoomMessage, @Req() req: Request, @Res() res: Response) {
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
