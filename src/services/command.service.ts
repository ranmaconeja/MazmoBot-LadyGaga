import { Injectable, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { CommandHandler } from '../types';
import { AyudaHandler } from '../commands/ayuda';
import { PingHandler } from '../commands/ping';
import { VersionHandler } from '../commands/version';
import { StaffHandler } from '../commands/staff';
import { CreadorHandler } from '../commands/creador';
import { FilosofiaHandler } from '../commands/filosofia';
import { ReglasHandler } from '../commands/reglas';
import { PuntosHandler } from '../commands/puntos';
import { SumarPuntosHandler } from '../commands/sumarpuntos';
import { PerfilHandler } from '../commands/perfil';
import { BienvenidaHandler } from '../commands/bienvenida';
import { CompatibilidadHandler } from '../commands/compatibilidad';
import { CompatibilidadTestHandler } from '../commands/compatibilidadtest';
import { CompatibilidadAstralHandler } from '../commands/compatibilidadastral';
import { ReproducirHandler } from '../commands/reproducir';
import { PracticaHandler } from '../commands/practica';
import { HoroscopoHandler } from '../commands/horoscopo';
import { MusicaHandler } from '../commands/musica';
import { DiaHandler } from '../commands/dia';
import { PointsService } from './points.service';
import { BotService } from './bot.service';
import { MessagesService } from './messages.service';
import { RoomMessage } from '../types';

@Injectable()
export class CommandService {
    private readonly logger = new Logger('CommandRouting');

    /**
     * Prefijo de activación para los comandos, en caso de especificarse, los comandos handlers de comandos
     * solamente se dispararán si el mensaje comienza con commandActivationPrefix, en este caso el comando será la
     * segunda cadena (tomando el espacio como separador) identificada, ejemplo de interpretación al especificar prefijo:
     * <prefijo> <comando> <mensaje>
     */
    private commandActivationPrefix = ''

    /**
     * CommandHandlers registrados en el bot. NO modificar manualmente, inyectarlos y registrarlos en el constructor
     * mediante la llamada a `this.registerHandler(commandHandler)`
     */
    private handlers: { [key: string]: CommandHandler } = {};

    /**
     * Comandos que no cobran el costo en puntos (ver PointsService), aunque el usuario
     * no sea moderador/owner. Se guardan en minúsculas.
     *
     * Incluye tanto comandos de consulta libre (!puntos, !ayuda) como comandos
     * exclusivos de moderadores/owner (!addPuntos, !lazotest):
     * estos últimos ya tienen su propio chequeo de permisos adentro del handler,
     * así que cobrarle puntos a un usuario común que los intenta usar (y que de
     * todos modos va a ser rechazado con "no tenés permisos") no tendría sentido.
     */
    private readonly freeCommands = new Set(['!puntos', '!ayuda', '!addpuntos', '!lazotest']);

    constructor(
        private readonly ayudaHandler: AyudaHandler,
        private readonly pingHandler: PingHandler,
        private readonly versionHandler: VersionHandler,
        private readonly staffHandler: StaffHandler,
        private readonly creadorHandler: CreadorHandler,
        private readonly filosofiaHandler: FilosofiaHandler,
        private readonly reglasHandler: ReglasHandler,
        private readonly puntosHandler: PuntosHandler,
        private readonly sumarPuntosHandler: SumarPuntosHandler,
        private readonly perfilHandler: PerfilHandler,
        private readonly bienvenidaHandler: BienvenidaHandler,
        private readonly compatibilidadHandler: CompatibilidadHandler,
        private readonly compatibilidadTestHandler: CompatibilidadTestHandler,
        private readonly compatibilidadAstralHandler: CompatibilidadAstralHandler,
        private readonly reproducirHandler: ReproducirHandler,
        private readonly practicaHandler: PracticaHandler,
        private readonly horoscopoHandler: HoroscopoHandler,
        private readonly musicaHandler: MusicaHandler,
        private readonly diaHandler: DiaHandler,
        private readonly pointsService: PointsService,
        private readonly botService: BotService,
        private readonly messagesService: MessagesService,
    ) {
        this.registerHandler(ayudaHandler)
        this.registerHandler(pingHandler)
        this.registerHandler(versionHandler)
        this.registerHandler(staffHandler)
        this.registerHandler(creadorHandler)
        this.registerHandler(filosofiaHandler)
        this.registerHandler(reglasHandler)
        this.registerHandler(puntosHandler)
        this.registerHandler(sumarPuntosHandler)
        this.registerHandler(perfilHandler)
        this.registerHandler(bienvenidaHandler)
        this.registerHandler(compatibilidadHandler)
        this.registerHandler(compatibilidadTestHandler)
        this.registerHandler(compatibilidadAstralHandler)
        this.registerHandler(reproducirHandler)
        this.registerHandler(practicaHandler)
        this.registerHandler(horoscopoHandler)
        this.registerHandler(musicaHandler)
        this.registerHandler(diaHandler)
    }

    private registerHandler(handler: CommandHandler) {
        // se guarda en minúsculas para que el comando funcione sin importar
        // cómo lo hayan tipeado (!Ping, !PING, !ping, etc. son todos el mismo comando)
        this.handlers[handler.getSignature().toLowerCase()] = handler;
    }

    async handle(rawContent: string, req: Request, res: Response): Promise<boolean> {
        const messageParts = rawContent.split(' ');
        let command: string | null = messageParts[0]
        if (this.commandActivationPrefix) {
            // remover prefijo
            messageParts.splice(0, 1)

            // verificar que haya al menos un comando y el prefijo de activación
            if (messageParts.length && (this.commandActivationPrefix === command)) {
                command = messageParts[0]
            }
            else {
                // resetear comando
                command = null
            }
        }

        const commandKey = command ? command.toLowerCase() : command;

        if (commandKey && this.handlers[commandKey]) {
            // remover comando
            messageParts.splice(0, 1)

            const body = req.body as RoomMessage;
            const userId = body.message.author.id;

            if (!this.freeCommands.has(commandKey) && !(await this.pointsService.canUseCommand(userId))) {
                const points = await this.pointsService.getPoints(userId);
                this.logger.log(`Comando "${command}" bloqueado: usuario ${userId} no tiene suficientes puntos (tiene ${points}, necesita ${this.pointsService.getCommandCost()})`);
                const authorData = await this.botService.getUserData(userId);
                const text = this.messagesService.get('SIN_PUNTOS', {
                    USERNAME: authorData?.username ?? String(userId),
                    COST: String(this.pointsService.getCommandCost()),
                    POINTS: String(points),
                });
                await this.botService.notifyUser(body.key, body.message.channel.id, userId, text);
                return true
            }

            this.logger.log(`Comando "${command}" matcheó con un handler, ejecutando...`);
            // se ha encontrado coincidencia para un comando registrado
            await this.handlers[commandKey].handleCommand(req, res, messageParts.join(' '));
            if (!this.freeCommands.has(commandKey)) {
                await this.pointsService.spendCommandCost(userId);
            }
            this.logger.log(`Comando "${command}" terminó de ejecutarse`);
            return true
        }
        else {
            this.logger.warn(`Comando "${command}" NO matcheó con ningún handler registrado`);
            return false
        }
    }
}
