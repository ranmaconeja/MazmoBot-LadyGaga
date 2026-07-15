import { HttpModule, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { BotService } from './services/bot.service';
import { BotRequestMiddleware } from './middleware/botRequest';
import { CommandService } from './services/command.service';

import { ConfigService } from './services/config.service';
import { MessagesService } from './services/messages.service';
import { ModeratorsService } from './services/moderators.service';
import { TagsService } from './services/tags.service';

import { DatabaseService } from './database/database.service';
import { PointsRepository } from './database/points.repository';
import { PointsService } from './services/points.service';

import { WelcomeService } from './modules/welcome/welcome.service';
import { AutofrasesService } from './modules/autofrases/autofrases.service';
import { BusquedaService } from './modules/busqueda/busqueda.service';

import { YoutubeService } from './modules/youtube/youtube.service';
import { AiService } from './modules/ai/ai.service';
import { GroqService } from './modules/ai/groq.service';
import { AiRaceService } from './modules/ai/ai-race.service';
import { CompatibilityService } from './modules/ai/compatibility.service';
import { AstralCompatibilityService } from './modules/ai/astral-compatibility.service';
import { PracticeService } from './modules/ai/practice.service';
import { PlayerQueueService } from './modules/player/player-queue.service';
import { PlayerController } from './player.controller';

import { AyudaHandler } from './commands/ayuda';
import { PingHandler } from './commands/ping';
import { VersionHandler } from './commands/version';
import { StaffHandler } from './commands/staff';
import { CreadorHandler } from './commands/creador';
import { FilosofiaHandler } from './commands/filosofia';
import { ReglasHandler } from './commands/reglas';
import { PuntosHandler } from './commands/puntos';
import { SumarPuntosHandler } from './commands/sumarpuntos';
import { PerfilHandler } from './commands/perfil';
import { BienvenidaHandler } from './commands/bienvenida';
import { CompatibilidadHandler } from './commands/compatibilidad';
import { CompatibilidadTestHandler } from './commands/compatibilidadtest';
import { CompatibilidadAstralHandler } from './commands/compatibilidadastral';
import { ReproducirHandler } from './commands/reproducir';
import { BotellitaHandler } from './commands/botellita';
import { PracticaHandler } from './commands/practica';

@Module({
    imports: [
        HttpModule
    ],
    controllers: [
        AppController,
        PlayerController,
    ],
    providers: [
        BotService,
        CommandService,

        // config
        ConfigService,
        MessagesService,
        ModeratorsService,
        TagsService,

        // base de datos
        DatabaseService,
        PointsRepository,
        PointsService,

        // módulos
        WelcomeService,
        AutofrasesService,
        BusquedaService,
        YoutubeService,
        AiService,
        GroqService,
        AiRaceService,
        CompatibilityService,
        AstralCompatibilityService,
        PracticeService,
        PlayerQueueService,

        // comandos
        AyudaHandler,
        PingHandler,
        VersionHandler,
        StaffHandler,
        CreadorHandler,
        FilosofiaHandler,
        ReglasHandler,
        PuntosHandler,
        SumarPuntosHandler,
        PerfilHandler,
        BienvenidaHandler,
        CompatibilidadHandler,
        CompatibilidadTestHandler,
        CompatibilidadAstralHandler,
        ReproducirHandler,
        BotellitaHandler,
        PracticaHandler,
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // configura el middleware de verificación de header para el controlador principal
        consumer.apply(BotRequestMiddleware).forRoutes(AppController)
    }
}
