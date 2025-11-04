"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENCIES = exports.GAME_STATES = exports.GAME_CONFIG = void 0;
exports.GAME_CONFIG = {
    BETTING_TIME: 10,
    MIN_BET: {
        TON: '0.1',
        STARS: 10,
    },
    MAX_BET: {
        TON: '1000',
        STARS: 100000,
    },
    MIN_CRASH_POINT: '1.00',
    MAX_CRASH_POINT: '1000.00',
    HOUSE_FEE: '0.01',
    GIFT_MARKUP: '0.10',
    REFERRAL: {
        BASIC_DEPOSIT: '0.10',
        PLUS_DEPOSIT: '0.10',
        PLUS_LOSSES: '0.50',
    },
    MULTIPLIER_UPDATE_INTERVAL: 100,
    MAX_PLAYERS_PER_ROUND: 1000,
};
exports.GAME_STATES = {
    BETTING: 'betting',
    FLYING: 'flying',
    CRASHED: 'crashed',
};
exports.CURRENCIES = {
    TON: 'ton',
    STARS: 'stars',
    GIFT: 'gift',
};
//# sourceMappingURL=game.js.map