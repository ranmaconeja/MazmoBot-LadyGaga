import { HttpException, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class BotRequestMiddleware implements NestMiddleware {
    private readonly logger = new Logger('IncomingRequest');

    use(req: Request, res: Response, next: NextFunction) {
        const receivedSecret = String(req.headers['bot-secret'] ?? '').trim();
        const expectedSecret = String(process.env.BOT_SECRET ?? '').trim();

        if (!expectedSecret) {
            // sin BOT_SECRET configurada no hay nada contra qué comparar: se rechaza toda
            // request (antes, con expectedSecret === '' y sin header, '' !== '' daba false
            // y la request pasaba sin ninguna credencial real)
            this.logger.error(`BOT_SECRET no está configurada en las variables de entorno del servidor: se rechaza la request a ${req.method} ${req.originalUrl}`);
            throw new HttpException('Forbidden', 403)
        }

        if (receivedSecret !== expectedSecret) {
            // log temporal de diagnóstico: no imprime los secrets completos, solo largos, para
            // detectar espacios/saltos de línea de más sin exponer el valor real
            this.logger.warn(`Request a ${req.method} ${req.originalUrl} RECHAZADA: bot-secret no coincide (recibido: ${receivedSecret.length} caracteres, esperado: ${expectedSecret.length} caracteres)`);
            throw new HttpException('Forbidden', 403)
        }

        this.logger.log(`Request a ${req.method} ${req.originalUrl} ACEPTADA`);
        next();
    }
}
