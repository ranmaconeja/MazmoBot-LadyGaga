import { HttpService, Injectable, Logger } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { AnyDict, RoomReplyMessage, SadesAsk, UserData, UserNotify } from '../types';

@Injectable()
export class BotService {
    private readonly logger = new Logger('OutgoingRequest');

    constructor(private httpService: HttpService) {}

    /**
     * Headers de autenticación para las llamadas salientes a la API de Mazmo.
     * Migrado el 05/08/2026 del viejo esquema de bots (Bot-Key distinto por
     * canal, sacado de cada mensaje entrante) al nuevo de cuentas de
     * Organización: un solo token fijo (MAZMO_ORG_TOKEN), igual para
     * cualquier canal, que no expira por canal y se puede revocar entero
     * desde los ajustes de la organización en Mazmo.
     *
     * El parámetro `replyKey` que reciben sendReply/notifyUser/banUser/etc.
     * quedó sin uso real (era la key vieja) — se dejó en las firmas de todas
     * formas para no tener que tocar los ~20 comandos que ya lo pasan como
     * primer argumento; es un parámetro vestigial hoy, no rompe nada dejarlo.
     */
    private authHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MAZMO_ORG_TOKEN}`,
        };
    }

    /**
     * Envía un mensaje a un canal.
     * @param string replyKey Vestigial, ver authHeaders() — ya no se usa para autenticar.
     * @param string channelId
     * @param string replyPayload Especificar en rawContent el mensaje a enviar a la sala, otras propiedades son opcionales y dependen del tipo de mensaje a enviar
     */
    private async sendMessageToChannel(replyKey: string, channelId: string, replyPayload: RoomReplyMessage) {
        const postbackUrl = `https://prod.mazmoapi.net/chat/channels/${channelId}/messages`
        const config: AxiosRequestConfig = {
            method: 'POST',
            headers: this.authHeaders(),
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
     * Banea a un usuario de un canal.
     * Endpoint confirmado el 01/08/2026 inspeccionando el tráfico real de mazmo.net:
     * POST /chat/channels/{channelId}/bans, body: { bannedUserId: <number> }.
     * Ahora autenticado con el token de la Organización — al ser una cuenta
     * real que se une al canal como participante (a diferencia de los bots
     * viejos), es más probable que sí se le pueda dar rol de moderador y esto
     * funcione de verdad. Igual devuelve false y loguea el detalle si Mazmo
     * lo rechaza, por si todavía hace falta ese permiso aparte.
     */
    async banUser(replyKey: string, channelId: string, bannedUserId: number, reason?: string): Promise<boolean> {
        const url = `https://prod.mazmoapi.net/chat/channels/${channelId}/bans`
        const config: AxiosRequestConfig = {
            method: 'POST',
            headers: this.authHeaders(),
        }
        const payload: AnyDict = { bannedUserId }
        if (reason) {
            payload.reason = reason
        }

        return this.httpService.post(url, payload, config).toPromise()
            .then(() => {
                this.logger.log(`Usuario ${bannedUserId} baneado OK en el canal ${channelId}`);
                return true;
            })
            .catch(e => {
                this.logger.error(`FALLÓ el baneo del usuario ${bannedUserId} en el canal ${channelId}: status ${e?.response?.status}, body: ${JSON.stringify(e?.response?.data)}, mensaje: ${e?.message}`);
                return false;
            })
    }


    /**
     * Devuelve los datos de un usuario por su ID numérico.
     */
    async getUserData(userId: number): Promise<UserData> {
        return this.fetchUser(userId);
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
     * Es una consulta pública, no lleva autenticación.
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

        return res.data as UserData
    }

    /**
     * Devuelve el balance de sades de la organización.
     * Antes usaba ?botSecret=... como query param; ahora Bearer, igual que
     * el resto — no confirmado de forma directa para este endpoint puntual
     * (el anuncio de Mazmo no lo menciona explícitamente), es una inferencia
     * razonable dado que todo lo demás migró a este esquema.
     */
    async getBalance(): Promise<number> {
        const config: AxiosRequestConfig = {
            headers: this.authHeaders(),
        }
        const { data: { balance } } = await this.httpService.get('https://prod.mazmoapi.net/bank/boxes/balance', config).toPromise().catch(e => { return { data: {balance: 0} } })
        return balance ?? 0
    }

    /**
     * Envía una notificación a un canal para un usuario específico.
     * Solo el usuario destinatario podrá ver el mensaje (confirmado en
     * producción el 15/07/2026: Mazmo lo muestra con la etiqueta "Sólo vos
     * podés ver este mensaje", visible solo para el destinatario).
     * @param replyKey Vestigial, ver authHeaders() — ya no se usa para autenticar.
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
     * @param replyKey Vestigial, ver authHeaders() — ya no se usa para autenticar.
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
            headers: this.authHeaders(),
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
     * @param string replyKey Vestigial, ver authHeaders() — ya no se usa para autenticar.
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
