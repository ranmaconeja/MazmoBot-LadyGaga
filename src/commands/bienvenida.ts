import { CommandHandler, RoomMessage } from '../types';
import { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { WelcomeService } from '../modules/welcome/welcome.service';

@Injectable()
export class BienvenidaHandler implements CommandHandler {
    constructor(private readonly welcomeService: WelcomeService) {
    }

    getSignature(): string {
        return '!bienvenida';
    }

    async handleCommand(req: Request, res: Response, message: string) {
        const body = req.body as RoomMessage;
        await this.welcomeService.welcomeUser(body);
    }
}
