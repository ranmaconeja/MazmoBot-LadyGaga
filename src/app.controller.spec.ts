import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { BotService } from './services/bot.service';
import { CommandService } from './services/command.service';
import { WelcomeService } from './modules/welcome/welcome.service';
import { AutofrasesService } from './modules/autofrases/autofrases.service';
import { BusquedaService } from './modules/busqueda/busqueda.service';
import { YoutubeService } from './modules/youtube/youtube.service';
import { MessagesService } from './services/messages.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: BotService, useValue: {} },
        { provide: CommandService, useValue: { handle: jest.fn() } },
        { provide: WelcomeService, useValue: { welcomeUser: jest.fn() } },
        { provide: AutofrasesService, useValue: { checkMessage: jest.fn() } },
        { provide: BusquedaService, useValue: { checkMessage: jest.fn() } },
        { provide: YoutubeService, useValue: { extractVideoId: jest.fn(), getVideoInfo: jest.fn() } },
        { provide: MessagesService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });
});
