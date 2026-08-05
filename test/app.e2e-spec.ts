import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { DatabaseService } from '../src/database/database.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.MAZMO_WEBHOOK_SIGNING_KEY = process.env.MAZMO_WEBHOOK_SIGNING_KEY || 'test-signing-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // se reemplaza por un mock sin conexión real a Turso: este test no necesita
      // tocar la base (corta en el middleware antes de llegar a código que la use),
      // así que no tiene sentido depender de TURSO_DATABASE_URL/TURSO_AUTH_TOKEN reales
      // para poder correrlo en CI o en una máquina sin esas variables configuradas
      .overrideProvider(DatabaseService)
      .useValue({
        getClient: () => ({
          execute: async () => ({ rows: [] }),
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/message (POST) sin firma HMAC válida debe devolver 403', () => {
    return request(app.getHttpServer())
      .post('/message')
      .send({})
      .expect(403);
  });
});
