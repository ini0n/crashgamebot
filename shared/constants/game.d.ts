export declare const GAME_CONFIG: {
    readonly BETTING_TIME: 10;
    readonly MIN_BET: {
        readonly TON: "0.1";
        readonly STARS: 10;
    };
    readonly MAX_BET: {
        readonly TON: "1000";
        readonly STARS: 100000;
    };
    readonly MIN_CRASH_POINT: "1.00";
    readonly MAX_CRASH_POINT: "1000.00";
    readonly HOUSE_FEE: "0.01";
    readonly GIFT_MARKUP: "0.10";
    readonly REFERRAL: {
        readonly BASIC_DEPOSIT: "0.10";
        readonly PLUS_DEPOSIT: "0.10";
        readonly PLUS_LOSSES: "0.50";
    };
    readonly MULTIPLIER_UPDATE_INTERVAL: 100;
    readonly MAX_PLAYERS_PER_ROUND: 1000;
};
export declare const GAME_STATES: {
    readonly BETTING: "betting";
    readonly FLYING: "flying";
    readonly CRASHED: "crashed";
};
export declare const CURRENCIES: {
    readonly TON: "ton";
    readonly STARS: "stars";
    readonly GIFT: "gift";
};
//# sourceMappingURL=game.d.ts.map