// Game types for crash game logic

export type GameStatus = 'betting' | 'flying' | 'crashed';
export type CurrencyType = 'ton' | 'stars';

export interface GameRound {
  id: string;
  crashPoint: string; // Decimal as string (e.g., "2.45")
  serverSeed: string;
  hashedServerSeed: string;
  status: GameStatus;
  startTime: Date;
  endTime?: Date;
  houseFee: string; // Decimal as string (e.g., "0.01" for 1%)
}

export interface Bet {
  id: string;
  userId: string;
  roundId: string;
  amount: string; // Decimal as string for precision
  currency: CurrencyType;
  cashoutAt?: string; // Multiplier when cashed out (e.g., "1.50")
  cashedOut: boolean;
  profit?: string; // Decimal as string
  createdAt: Date;
}

export interface GameState {
  currentRound?: GameRound;
  nextRound?: GameRound;
  status: GameStatus;
  timeUntilNextRound: number; // seconds
  currentMultiplier: string; // Current multiplier (e.g., "1.00" to "999.99")
  activeBets: PublicBetInfo[];
  roundHistory: GameRound[];
}

export interface PublicBetInfo {
  id: string;
  username: string;
  amount: string;
  currency: CurrencyType;
  cashoutAt?: string;
  cashedOut: boolean;
  profit?: string;
}

export interface PlaceBetRequest {
  amount: string;
  currency: CurrencyType;
}

export interface CashoutRequest {
  // No additional data needed - user identified by socket
}

export interface CashoutResult {
  success: boolean;
  multiplier?: string;
  profit?: string;
  error?: string;
}

export interface RoundResult {
  roundId: string;
  crashPoint: string;
  winners: PublicBetInfo[];
  losers: PublicBetInfo[];
}

// Provably Fair types
export interface ProvablyFair {
  serverSeed: string;
  hashedServerSeed: string;
  crashPoint: string;
  roundId: string;
}
