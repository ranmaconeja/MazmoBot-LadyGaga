import { HttpException, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Reemplaza al viejo esquema de bot-secret en crudo, después de la migración
 * de "bots" a cuentas de Organización que anunció Mazmo (los bots dejan de
 * funcionar el 05/09/2026). Cada webhook entrante ahora viaja firmado con
 * HMAC-SHA256 en el header X-Mazmo-Signature (formato "sha256=<hex>"),
 * calculado sobre el body CRUDO (sin parsear) usando la clave de firma de la
 * organización — no un secreto plano que alcance con que coincida.
 *
 * Necesita req.rawBody, capturado en el `verify` callback de express.json()
 * ANTES de parsearlo como JSON (ver main.ts / api/index.ts) — si no está
 * disponible, no hay forma de recalcular la firma y se rechaza la request.
 */
@Injectable()
export class BotRequestMiddleware implements NestMiddleware {
    private readonly logger = new Logger('IncomingRequest');

    use(req: Request, res: Response, next: NextFunction) {
        const signingKey = String(process.env.MAZMO_WEBHOOK_SIGNING_KEY ?? '').trim();

        if (!signingKey) {
            // sin clave de firma configurada no hay nada contra qué comparar: se
            // rechaza toda request (fail-closed, mismo criterio que antes con BOT_SECRET)
            this.logger.error(`MAZMO_WEBHOOK_SIGNING_KEY no está configurada en las variables de entorno del servidor: se rechaza la request a ${req.method} ${req.originalUrl}`);
            throw new HttpException('Forbidden', 403)
        }

        const signatureHeader = String(req.headers['x-mazmo-signature'] ?? '').trim();
        const rawBody: Buffer | undefined = (req as any).rawBody;

        if (!signatureHeader || !rawBody) {
            this.logger.warn(`Request a ${req.method} ${req.originalUrl} RECHAZADA: falta el header X-Mazmo-Signature o no se pudo capturar el body crudo`);
            throw new HttpException('Forbidden', 403)
        }

        const expectedSignature = 'sha256=' + createHmac('sha256', signingKey).update(rawBody).digest('hex');

        const receivedBuffer = Buffer.from(signatureHeader);
        const expectedBuffer = Buffer.from(expectedSignature);

        // timingSafeEqual tira una excepción (no devuelve false) si los buffers
        // tienen largos distintos, así que hay que chequear el largo antes de
        // comparar — si no, una firma mal formada tumbaría la función en vez
        // de simplemente rechazarse
        const isValid = receivedBuffer.length === expectedBuffer.length
            && timingSafeEqual(receivedBuffer, expectedBuffer);

        if (!isValid) {
            this.logger.warn(`Request a ${req.method} ${req.originalUrl} RECHAZADA: firma HMAC no coincide`);
            throw new HttpException('Forbidden', 403)
        }

        this.logger.log(`Request a ${req.method} ${req.originalUrl} ACEPTADA`);
        next();
    }
}
