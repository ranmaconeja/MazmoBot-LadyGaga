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
import { HangmanService } from './services/hangman.service';
import { PointsService } from './services/points.service';
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
        private hangmanService: HangmanService,
        private pointsService: PointsService,
    ) {
    }

    /**
     * Endpoint ejecutado al recibir mensaje de la sala, incluye la lógica necesaria para ejecutar los
     * commandHandlers registrados en el constructor.
     *
     * ⚠️ 05/08/2026: la migración de bot a cuenta de Organización cambió la
     * forma del payload que manda Mazmo (con el esquema viejo era
     * body.message.payload.rawContent, etc. — eso ya no funciona, tira
     * "Cannot read properties of undefined"). Todavía no se confirmó la
     * forma nueva, así que esto extrae de forma defensiva probando varias
     * rutas posibles, y loguea el body crudo completo para poder ajustar con
     * datos reales en vez de seguir adivinando. Mientras no se confirme,
     * si no se puede extraer algo esencial, no crashea: loguea un warning y
     * corta ahí, en vez de tirar abajo el mensaje entero (y de paso todos los
     * comandos, que dependían de este mismo endpoint para todo).
     *
     * ✅ 05/08/2026, forma real CONFIRMADA con un payload de producción:
     * { event: "channel.message", payload: { channelId, message: { channel,
     * author, payload: { rawContent, userMentions, ... }, authorId, ... } } }
     * Ya no viaja ningún campo "key" — la autenticación ahora es con
     * MAZMO_ORG_TOKEN fijo (ver bot.service.ts), no con una key por mensaje.
     *
     * ⚠️ El objeto "channel" acá YA NO trae "participants" (este canal tiene
     * 7133 participantes — mandarlos completos en cada mensaje sería
     * altísimo volumen). Esto rompe RandomMentionService (la función de
     * "quien"), que dependía de ese campo — hasta que se resuelva de otra
     * forma, "quien" no va a poder mencionar a nadie al azar.
     */
    @Post('message')
    async onRoomMessage(@Body() body: AnyDict, @Req() req: Request, @Res() res: Response) {
        this.logger.debug(`onRoomMessage: body crudo recibido: ${JSON.stringify(body)}`);

        const messageBody = body?.payload?.message;
        const rawContentRaw = messageBody?.payload?.rawContent;
        const channelId = body?.payload?.channelId ?? messageBody?.channel?.id;
        const authorId = messageBody?.author?.id ?? messageBody?.authorId;
        // ya no existe una "key" por mensaje — se deja vacía, bot.service.ts
        // ignora este parámetro y autentica con MAZMO_ORG_TOKEN en su lugar
        const replyKey = '';

        if (!rawContentRaw || !channelId || !authorId) {
            this.logger.warn(`onRoomMessage: no se pudo extraer todo lo necesario del payload (rawContent=${!!rawContentRaw}, channelId=${channelId}, authorId=${authorId}) — revisar el log "body crudo recibido" de arriba`);
            res.status(200).send('OK');
            return;
        }

        const rawContent = stripHtml(rawContentRaw);
        this.logger.log(`Mensaje recibido: "${rawContent}" (autor id: ${authorId}, canal: ${channelId})`);

        // ⚠️ 08/08/2026: ahora que el bot es una cuenta de Organización real
        // (participante del canal, no un "bot" externo como antes), Mazmo
        // manda este mismo webhook también por los mensajes que publica el
        // propio bot — sin este chequeo, !musica (y cualquier otra respuesta
        // que contenga un link de YouTube) se "leía a sí misma" y volvía a
        // publicar la miniatura del video una segunda vez.
        //
        // Se compara authorId contra MAZMO_ORG_ID (confirmado con datos
        // reales: viene en subscribedOrgs del payload del canal) — si no
        // está configurada esa variable, se usa author.type !== 'USER' como
        // respaldo (no confirmado con un mensaje real del bot todavía, por
        // las dudas se loguea para poder ajustar si hace falta).
        const authorType = messageBody?.author?.type;
        const esMensajePropio = (process.env.MAZMO_ORG_ID && String(authorId) === String(process.env.MAZMO_ORG_ID))
            || (authorType && authorType !== 'USER');

        if (esMensajePropio) {
            this.logger.debug(`onRoomMessage: mensaje del propio bot (authorId=${authorId}, author.type=${authorType}), se ignora para no auto-responderse`);
            res.status(200).send('OK');
            return;
        }

        // reconstruye el body en la forma vieja que ya esperan CommandService y
        // los ~20 comandos (RoomMessage) — messageBody ya trae casi exactamente
        // esa forma (channel, author, payload.rawContent, etc.), así que no
        // hace falta tocar cada comando por separado
        (req as any).body = {
            key: replyKey,
            message: messageBody,
        };
        const normalizedBody = (req as any).body;

        if (! await this.commandService.handle(rawContent, req, res)) {
            // no se ha encontrado coincidencia para un comando registrado

            // chequeamos si el mensaje dispara alguna autofrase por palabra clave
            const autoResponse = this.autofrasesService.checkMessage(rawContent);
            if (autoResponse) {
                await this.botService.sendReply(replyKey, channelId, autoResponse);
            }

            // si el mensaje contiene la palabra "quien" (sola, no "quienes" ni
            // "aquien"), mencionamos a un participante al azar del canal
            if (/\bquien\b/i.test(rawContent)) {
                const username = await this.randomMentionService.pickRandomParticipant(normalizedBody);
                if (username) {
                    const text = this.messagesService.get('QUIEN_RESPUESTA', { USERNAME: username });
                    await this.botService.sendReply(replyKey, channelId, text);
                }
            }

            // si hay una partida de !suspension activa en este canal, chequeamos
            // dos cosas con el mismo mensaje: si es una sola letra (intento
            // normal, con penalidad si falla), o si el mensaje entero coincide
            // con la palabra secreta (gana directo, sin pedir ningún comando
            // aparte — y si NO coincide, no hacemos nada, ni penaliza ni
            // manda ningún mensaje, para no interferir con la charla normal)
            const game = await this.hangmanService.getActiveGame(channelId);
            if (game) {
                const soloUnaLetra = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ]$/.test(rawContent.trim());

                if (soloUnaLetra) {
                    const result = await this.hangmanService.guessLetter(game, rawContent.trim());

                    if (!result.alreadyGuessed) {
                        if (result.won) {
                            await this.pointsService.addPointsManually(authorId, 10);
                            const text = this.messagesService.get('AHORCADO_GANADO', {
                                DIBUJO: this.hangmanService.drawHangman(result.game.wrongCount),
                                PALABRA: result.game.word,
                                PUNTOS: '10',
                            });
                            await this.botService.sendReply(replyKey, channelId, text);
                        } else if (result.lost) {
                            const text = this.messagesService.get('AHORCADO_PERDIDO', {
                                DIBUJO: this.hangmanService.drawHangman(result.game.wrongCount),
                                PALABRA: result.game.word,
                            });
                            await this.botService.sendReply(replyKey, channelId, text);
                        } else {
                            const text = this.messagesService.get(result.correct ? 'AHORCADO_LETRA_CORRECTA' : 'AHORCADO_LETRA_INCORRECTA', {
                                PALABRA: this.hangmanService.maskWord(result.game),
                                RESTANTES: String(this.hangmanService.getMaxWrong() - result.game.wrongCount),
                            });
                            await this.botService.sendReply(replyKey, channelId, text);
                        }
                    }
                } else if (this.hangmanService.isWordMatch(game, rawContent.trim())) {
                    const wonGame = await this.hangmanService.winByWord(game);
                    await this.pointsService.addPointsManually(authorId, 10);
                    const text = this.messagesService.get('AHORCADO_GANADO', {
                        DIBUJO: this.hangmanService.drawHangman(wonGame.wrongCount),
                        PALABRA: wonGame.word,
                        PUNTOS: '10',
                    });
                    await this.botService.sendReply(replyKey, channelId, text);
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
                await this.botService.sendReply(replyKey, channelId, text);
            }
        } else {
            // sin video individual: puede ser un link de playlist pura
            // (youtube.com/playlist?list=...)
            const playlistId = this.youtubeService.extractPlaylistId(rawContent);
            if (playlistId) {
                const playlistInfo = await this.youtubeService.getPlaylistInfo(playlistId);
                if (playlistInfo) {
                    const text = this.messagesService.get('YOUTUBE_PLAYLIST_INFO', {
                        TITLE: playlistInfo.title,
                        DESCRIPTION: playlistInfo.description,
                        THUMBNAIL_URL: playlistInfo.thumbnailUrl,
                        CANAL: playlistInfo.channelTitle,
                        CANTIDAD: String(playlistInfo.itemCount),
                    });
                    await this.botService.sendReply(replyKey, channelId, text);
                }
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
     *  ⚠️ La forma exacta de ESTE evento puntual (channel.ban) todavía no se
     *  confirmó con un payload real — se prioriza la misma forma que ya se
     *  confirmó para channel.message (body.payload.channelId), con
     *  fallbacks por si acá viene distinto. Revisar el log "body crudo
     *  recibido" de abajo si no postea el GIF.
     */
    @Post('new_ban')
    async onNewBan(@Body() body: AnyDict, @Req() req: Request, @Res() res: Response) {
        this.logger.debug(`onNewBan: body crudo recibido: ${JSON.stringify(body)}`);

        try {
            const channelId = body?.payload?.channelId
                ?? body?.payload?.message?.channel?.id
                ?? body?.message?.channel?.id
                ?? body?.channel?.id
                ?? body?.channelId;

            if (!channelId) {
                this.logger.warn(`onNewBan: no se pudo extraer channelId del payload, no se publica el GIF`);
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
            // replyKey vacío: ya no se usa para autenticar (ver bot.service.ts, MAZMO_ORG_TOKEN)
            await this.botService.sendReply('', channelId, text);
        } catch (e) {
            this.logger.error('onNewBan: error inesperado al procesar el ban: ' + e.message);
        }

        res.status(200).send('OK')
    }

    /**
     *  Endpoint para el evento channel.unban (cuenta de Organización) — se
     *  dispara cuando se le saca el baneo a alguien. Sin lógica todavía,
     *  gancho vacío listo para cuando haga falta (mismo patrón que los
     *  demás stubs de este controller).
     */
    @Post('new_unban')
    async onNewUnban(@Body() body: AnyDict, @Req() req: Request, @Res() res: Response) {
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
