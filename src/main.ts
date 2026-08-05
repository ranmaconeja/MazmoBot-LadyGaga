// tiene que ser el primer import: carga el .env a process.env antes de que
// cualquier otro módulo (que lea process.env en su constructor) se importe.
// Solo hace falta acá (desarrollo local con main.ts) — en Vercel (api/index.ts)
// las variables ya llegan puestas por el propio dashboard, no por un archivo.
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // bodyParser: false para poder configurar nosotros el límite de tamaño del body
  // (Mazmo manda payloads grandes con toda la info del canal/participantes, y el
  // límite por defecto de Express de 100kb se quedaba corto y rechazaba las requests
  // antes de que llegaran a nuestro código).
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // guarda el body crudo en req.rawBody ANTES de parsearlo como JSON — hace
  // falta tal cual, byte a byte, para verificar la firma HMAC de Mazmo
  // (channel_signature.service.ts / ver migración a cuentas de Organización)
  const rawBodySaver = (req: any, res: any, buf: Buffer) => {
    req.rawBody = buf;
  };
  app.use(json({ limit: '10mb', verify: rawBodySaver }));
  app.use(urlencoded({ extended: true, limit: '10mb', verify: rawBodySaver }));

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
