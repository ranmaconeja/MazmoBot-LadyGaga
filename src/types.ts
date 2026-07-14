import { Request, Response } from 'express';

export enum PRIVACIES {
    PUBLIC = 'PUBLIC',
    PRIVATE = 'PRIVATE',
};

export enum CHANNEL_ROLES {
    OWNER= 'OWNER',
    MOD = 'MOD',
    USER = 'USER',
};

export enum MESSAGE_TYPES {
    MESSAGE = 'MESSAGE',
    PART = 'PART',
    JOIN = 'JOIN',
    BAN = 'BAN',
    UNBAN = 'UNBAN',
}

export enum AUTHOR_TYPES {
    USER = 'USER',
    BOT = 'BOT',
    AUTORESPONDER = 'AUTORESPONDER'
};

export type RoomMessage = {
    message: {
        author: {
            type: AUTHOR_TYPES,
            id: number
        },
        payload: {
            media: {
                images: []
            },
            userMentions: [],
            sadesAsk: null,
            rawContent: string
        },
        toUserId: number,
        type: MESSAGE_TYPES,
        edited: boolean,
        channel: {
            participantCount: number,
            privacy: PRIVACIES,
            name: string,
            description: string,
            avatar: string,
            bans: [],
            bots: [
                {
                    bot: string
                }
            ],
            createdAt: string,
            updatedAt: string,
            lastMessage: string,
            participants: [
                {
                    role: CHANNEL_ROLES,
                    channel: string,
                    userId: number,
                    joinedAt: string,
                    readAt: string,
                    id: string
                }
            ],
            'id': string
        },
        reactions: [],
        createdAt: string,
        updatedAt: string,
        id: string,
        authorId: number
    },
    key: string
}


export type UserNotify = {
    type: string,
    toUserId: number,
    rawContent: string
}

export type SadesAsk = {
    rawContent: string,
    sadesAsk: {
        amount: number,
        fixed: boolean,
        transferData?: any
    }
}

export type SadesReceivedTransaction = {
    transaction: {
        tax: number,
        processed: string,
        from: {
            owner: {
                type: AUTHOR_TYPES,
                id: number
            }
        },
        to: {
            owner: {
                type: AUTHOR_TYPES,
                id: string
            }
        },
        amount: number,
        type: string,

        // payload enviado en transferData al requerir sades
        data: any,

        createdAt: string,
        updatedAt: string,
        id: string
    }
}


export type AvatarImage = {
    jpeg: string,
    webp: string
}

export type UserData = {
    tags: string[],
    knowingCount: number,
    knowedCount: number,
    eventCount: number,
    followingCount: number,
    followersCount: number,
    suspended: false,
    banned: false,
    starMode: false,
    membership: string,
    isOrganization: false,
    badges: string[],
    id: number,
    username: string,
    displayname: string,
    gender: string,
    pronoun: string,
    avatar: {
        default: string,
        '150w': AvatarImage,
        '50w': AvatarImage
        '32w': AvatarImage
    },
    cover: null,
    regdate: string,
    lastLogin: string,
    aboutMe: '',
    job: string,
    country: {
        id: string,
        name: string,
        isoCode: string
    },
    region: {
        id: string,
        name: string
    },
    city: null,
    oldtags: string[],
    tagSlots: number,
    age: number,
    tagsDescription: {
        inUse: string[],
        purchased: string[],
        available: number
    }
}

export type AnyDict = { [key: string]: any }

export type RoomReplyMessage = {
    rawContent: string,
    [key: string]: any
}

export interface CommandHandler {
    getSignature(): string
    handleCommand(req: Request, res: Response, message: string)
}
