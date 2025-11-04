// WebSocket event types for real-time communication

// Events sent from server to client
export interface ServerToClientEvents {
  // Game events
  'game:round_info': (data: { roundId: string; hashedServerSeed: string; status: string; serverTime: number; startTime: string; crashTime: number; bettingPhaseDuration: number; flyingPhaseDuration: number }) => void;
  'game:round_start': (data: { roundId: string; hashedServerSeed: string; serverTime: number; startTime: string; crashTime: number; bettingPhaseDuration: number; flyingPhaseDuration: number }) => void;
  'game:multiplier_update': (data: { multiplier: number; growthRate: number; serverTime: number }) => void;
  'game:round_crashed': (data: { crashMultiplier: number; serverTime: number }) => void;
  'game:round_results': (data: { roundId: string; crashMultiplier: number; serverTime: number }) => void;
  'game:bet_placed': (data: { betId: string; amount: number; currency: string; status: string; serverTime: number }) => void;
  'game:cashout_success': (data: { betId: string; cashoutAt: number; profit: string; status: string; serverTime: number }) => void;
  'game:error': (data: { message: string }) => void;

  // Connection events
  'connect': () => void;
  'disconnect': () => void;
  'error': (error: string) => void;
}

// Events sent from client to server
export interface ClientToServerEvents {
  // Game actions
  'game:connect': () => void;
  'game:place_bet': (data: { amount: number; currency: string }) => void;
  'game:cashout': (data: { multiplier: number; clientTime: number }) => void;
  'game:get_bet': (data: { betId: string }) => void;
}

// Socket data attached to each connection
export interface SocketData {
  userId: string;
  username: string;
  authenticated: boolean;
}
