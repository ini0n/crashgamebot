// Game configuration constants

export const GAME_CONFIG = {
  // Betting limits
  MIN_BET: {
    TON: '0.1',
    STARS: 10
  },
  
  // Game timing
  BETTING_TIME: 10, // seconds between rounds
  MULTIPLIER_UPDATE_INTERVAL: 300, // milliseconds
  
  // Game mechanics
  HOUSE_FEE: '0.01', // 1% house fee
  MAX_MULTIPLIER: '1000.00',
  MIN_MULTIPLIER: '1.00',
  
  // UI constants
  MAX_PLAYERS_DISPLAY: 50, // Maximum players to show in the list
  HISTORY_ROUNDS_DISPLAY: 10, // Number of previous rounds to show
  
  // Animation timing
  CRASH_ANIMATION_DURATION: 1000, // milliseconds
  ROCKET_ANIMATION_SPEED: 2, // pixels per frame
  
  // Multiplier calculation
  MULTIPLIER_PRECISION: 2, // decimal places for multiplier display
  
  // Auto-cashout limits
  MIN_AUTO_CASHOUT: '1.01',
  MAX_AUTO_CASHOUT: '1000.00'
} as const;

export const GAME_ERRORS = {
  BETTING_CLOSED: 'betting_closed',
  INSUFFICIENT_BALANCE: 'insufficient_balance',
  INVALID_AMOUNT: 'invalid_amount',
  ALREADY_CASHED_OUT: 'already_cashed_out',
  ROUND_NOT_ACTIVE: 'round_not_active',
  NO_ACTIVE_BET: 'no_active_bet',
  AUTHENTICATION_REQUIRED: 'authentication_required'
} as const;

export const CURRENCY_SYMBOLS = {
  ton: '💎',
  stars: '⭐'
} as const;

export const CURRENCY_NAMES = {
  ton: 'TON',
  stars: 'Stars'
} as const;
