import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AppModule } from '../src/app.module';

/**
 * Entrypoint para Vercel (funciones serverless). A diferencia de src/main.ts
 * (que se usa para hosting tradicional tipo Render, con app.listen() y un
 * proceso siempre prendido), acá NO se abre ningún puerto: Vercel invoca este
 * handler por cada request HTTP que le llega.
 *
 * La instancia de Nest se cachea en una variable de módulo: mientras la función
 * esté "caliente", Vercel reutiliza el mismo contenedor y nos ahorramos rearmar
 * toda la app en cada request. En una invocación "fría" se crea de cero.
 */
let cachedApp: Promise<NestExpressApplication> | null = null;

async function createApp(): Promise<NestExpressApplication> {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
    app.use(json({ limit: '10mb' }));
    app.use(urlencoded({ extended: true, limit: '10mb' }));
    await app.init();
    return app;
}

function getApp(): Promise<NestExpressApplication> {
    // se cachea la PROMESA (no el resultado ya resuelto): si dos invocaciones "frías"
    // pegan al mismo contenedor al mismo tiempo, ambas comparten la misma creación en
    // curso en vez de disparar dos NestFactory.create() en paralelo
    if (!cachedApp) {
        cachedApp = createApp().catch(err => {
            // si falla la creación, se limpia el cache para que el próximo request
            // pueda reintentar en vez de quedar pegado con una promesa rechazada
            cachedApp = null;
            throw err;
        });
    }
    return cachedApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const app = await getApp();
    const expressInstance = app.getHttpAdapter().getInstance();
    expressInstance(req, res);
}
