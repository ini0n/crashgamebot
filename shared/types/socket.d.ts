import { GameState, PublicBetInfo, RoundResult, CashoutResult } from './game';
import { UserBalance } from './user';
export interface ServerToClientEvents {
    'game:state': (state: GameState) => void;
    'game:round_start': (round: {
        id: string;
        startTime: Date;
    }) => void;
    'game:multiplier_update': (multiplier: string) => void;
    'game:round_end': (result: RoundResult) => void;
    'game:bet_placed': (bet: PublicBetInfo) => void;
    'user:balance_update': (balance: UserBalance) => void;
    'user:cashout': (result: CashoutResult) => void;
    'user:error': (error: string) => void;
    'system:maintenance': (message: string) => void;
    'system:notification': (notification: {
        type: 'info' | 'warning' | 'error';
        message: string;
    }) => void;
}
export interface ClientToServerEvents {
    'game:place_bet': (bet: {
        amount: string;
        currency: 'ton' | 'stars' | 'gift';
        giftId?: string;
    }) => void;
    'game:cashout': () => void;
    'game:get_state': () => void;
    'auth': (token: string) => void;
    'ping': () => void;
}
export interface SocketData {
    chatId?: string;
    authenticated: boolean;
    rooms: string[];
}
export interface BetAck {
    success: boolean;
    error?: string;
    betId?: string;
}
export interface CashoutAck {
    success: boolean;
    error?: string;
    result?: CashoutResult;
}
export interface AuthAck {
    success: boolean;
    error?: string;
    chatId?: string;
}
//# sourceMappingURL=socket.d.ts.map