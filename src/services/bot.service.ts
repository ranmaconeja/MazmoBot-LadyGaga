import { HttpService, Injectable, Logger } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { AnyDict, RoomReplyMessage, SadesAsk, UserData, UserNotify } from '../types';
import { KnownUsersRepository } from '../database/known-users.repository';

@Injectable()
export class BotService {
    private readonly logger = new Logger('OutgoingRequest');

    constructor(
        private httpService: HttpService,
        private readonly knownUsersRepository: KnownUsersRepository,
    ) {}


    /**
     * Envía un mensaje a un canal.
     * @param string replyKey
     * @param string channelId
     * @param string replyPayload Especificar en rawContent el mensaje a enviar a la sala, otras propiedades son opcionales y dependen del tipo de mensaje a enviar
     */
    private async sendMessageToChannel(replyKey: string, channelId: string, replyPayload: RoomReplyMessage) {
        const postbackUrl = `https://prod.mazmoapi.net/chat/channels/${channelId}/messages`
        const config: AxiosRequestConfig = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Bot-Key': replyKey,
            },
        }
        await this.httpService.post(postbackUrl, replyPayload, config).toPromise()
            .then(() => {
                this.logger.log(`Mensaje enviado OK al canal ${channelId}`);
            })
            .catch(e => {
                // log temporal de diagnóstico: la llamada a Mazmo para enviar la respuesta está fallando en silencio,
                // acá mostramos el status y el body del error (sin loggear la key completa) para saber por qué
                this.logger.error(`FALLÓ el envío al canal ${channelId}: status ${e?.response?.status}, body: ${JSON.stringify(e?.response?.data)}, mensaje: ${e?.message}`);
            })
    }


    /**
     * Devuelve los datos de un usuario por su ID numérico.
     *
     * GET /users/{id} de Mazmo no funciona de forma confiable (confirmado el
     * 16/07/2026: devuelve 404 incluso para ids válidos). Si falla, se intenta
     * el caché local id->username (ver KnownUsersRepository) y se reintenta
     * por username, que sí funciona siempre.
     */
    async getUserData(userId: number): Promise<UserData> {
        const direct = await this.fetchUser(userId);
        if (direct) {
            return direct;
        }

        const cachedUsername = await this.knownUsersRepository.getUsername(userId);
        if (cachedUsername) {
            this.logger.log(`getUserData(${userId}): lookup directo falló, usando cache -> "${cachedUsername}"`);
            return this.fetchUser(cachedUsername);
        }

        return null;
    }

    /**
     * Busca un usuario por su username (sin el @).
     */
    async getUserDataByUsername(username: string): Promise<UserData> {
        const cleanUsername = username.replace('@', '').trim()
        return this.fetchUser(cleanUsername);
    }

    /**
     * Endpoint confirmado el 12/07/2026 inspeccionando el tráfico real de mazmo.net:
     * GET /users/{username_o_id}?relationships=true&subscriptions=true&view=true
     * Acepta tanto un username como un ID numérico en el mismo path, y devuelve el
     * objeto de usuario directo (no envuelto por ID como se asumía antes).
     */
    private async fetchUser(identifier: string | number): Promise<UserData> {
        // encodeURIComponent evita que un identificador con caracteres como /, ?, & o espacios
        // rompa la URL o inyecte parámetros de query propios en la llamada a la API de Mazmo
        const url = `https://prod.mazmoapi.net/users/${encodeURIComponent(String(identifier))}?relationships=true&subscriptions=true&view=true`
        const res = await this.httpService.get(url).toPromise().catch(e => {
            this.logger.error(`FALLÓ fetchUser("${identifier}"): status ${e?.response?.status}, body: ${JSON.stringify(e?.response?.data)}, mensaje: ${e?.message}, url: ${url}`);
            return null
        })

        if (!res?.data?.id) {
            this.logger.warn(`fetchUser("${identifier}"): respuesta sin datos válidos, url: ${url}`);
            return null
        }

        const userData = res.data as UserData
        if (userData.id && userData.username) {
            // no bloqueamos la respuesta por esto: si falla el guardado en caché,
            // el usuario igual se resuelve bien esta vez
            this.knownUsersRepository.upsert(userData.id, userData.username).catch(() => {})
        }

        return userData
    }

    /**
     * Devuelve el balance de sades del bot
     */
    async getBalance(): Promise<number> {
        const config: AxiosRequestConfig = {
            params: { botSecret: process.env.BOT_SECRET }
        }
        const { data: { balance } } = await this.httpService.get('https://prod.mazmoapi.net/bank/boxes/balance', config).toPromise().catch(e => { return { data: {balance: 0} } })
        return balance ?? 0
    }

    /**
     * Envía una notificación a un canal para un usuario específico.
     * Solo el usuario destinatario podrá ver el mensaje (confirmado en
     * producción el 15/07/2026: Mazmo lo muestra con la etiqueta "Sólo vos
     * podés ver este mensaje", visible solo para el destinatario).
     * @param replyKey
     * @param channelId
     * @param toUserId
     * @param rawContent Mensaje a enviar a la sala, acepta el mismo markdown que la UI del chat
     */
    async notifyUser(replyKey: string, channelId: string, toUserId: number, rawContent: string) {
        const notification: UserNotify = {
            type: 'NOTICE',
            toUserId: toUserId,
            rawContent
        }

        await this.sendMessageToChannel(replyKey, channelId, notification)
    }

    /**
     * Envía un pedido de transferencia de sades a un canal.
     * @param replyKey
     * @param channelId
     * @param rawContent Mensaje a enviar a la sala, acepta el mismo markdown que la UI del chat
     * @param amount Cantidad de sades a pedir
     * @param fixed N/A
     * @param transferData Información que será enviada por mazmo al recibir sades
     */
    async requestSades(replyKey: string, channelId: string, rawContent: string, amount: number, fixed: boolean, transferData?: AnyDict) {
        const replyPayload: SadesAsk = {
            rawContent,
            sadesAsk: {
                amount,
                fixed,
            }
        }
        if (transferData) {
            replyPayload.sadesAsk.transferData = transferData
        }

        await this.sendMessageToChannel(replyKey, channelId, replyPayload)
    }

    async transferSadesToUser(toUserId: number, concept: string, amount: number) {
        const config: AxiosRequestConfig = {
            params: { botSecret: process.env.BOT_SECRET }
        }
        const payload = {
            to: { type: 'USER', id: toUserId },
            concept,
            amount,
            data: {},
        }
        await this.httpService.post('https://prod.mazmoapi.net/bank/transactions', payload, config).toPromise().catch(e => true)
    }

    /**
     * Envía un mensaje a un canal.
     * @param string replyKey
     * @param string channelId
     * @param string replyPayload Mensaje a enviar a la sala, acepta el mismo markdown que la UI del chat
     */
    async sendReply(replyKey: string, channelId: string, replyMessage: string) {
        await this.sendMessageToChannel(replyKey, channelId, { rawContent: replyMessage })
    }

    /**
     * Devuelve un objeto con el channelId y el replyKey para ser utilizado por defecto en el transferData de los pedidos de sades
     * @param replyKey
     * @param channelId
     * @param extraPayload Opcional. Objeto con propiedades extras a ser añadidas al objecto devuelto
     */
    getTransferData(replyKey: string, channelId: string, extraPayload?: AnyDict): AnyDict {
        return {
            replyKey,
            channelId,
            ...extraPayload
        }
    }
}
