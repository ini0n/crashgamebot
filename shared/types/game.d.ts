export type CurrencyType = 'ton' | 'stars' | 'gift';
export type GameStatus = 'betting' | 'flying' | 'crashed';
export interface GameRound {
    id: string;
    crashPoint: string;
    serverSeed: string;
    hashedServerSeed: string;
    status: GameStatus;
    houseFee: string;
    startTime: Date;
    endTime?: Date;
    createdAt: Date;
}
export interface Bet {
    id: string;
    chatId: string;
    roundId: string;
    amount: string;
    currency: CurrencyType;
    giftId?: string;
    cashoutAt?: string;
    cashedOut: boolean;
    profit?: string;
    createdAt: Date;
}
export interface GameState {
    currentRound?: GameRound;
    nextRound?: GameRound;
    timeUntilNextRound: number;
    currentMultiplier: string;
    isFlying: boolean;
    activeBets: PublicBetInfo[];
}
export interface PublicBetInfo {
    chatId: string;
    username?: string;
    amount: string;
    currency: CurrencyType;
    cashedOut: boolean;
    cashoutAt?: string;
    profit?: string;
}
export interface PlaceBetRequest {
    amount: string;
    currency: CurrencyType;
    giftId?: string;
}
export interface CashoutResult {
    success: boolean;
    multiplier?: string;
    profit?: string;
    message: string;
}
export interface RoundResult {
    roundId: string;
    crashPoint: string;
    serverSeed: string;
    winners: PublicBetInfo[];
    losers: PublicBetInfo[];
}
//# sourceMappingURL=game.d.ts.map