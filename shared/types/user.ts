export interface User {
  chatId: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  active: boolean;
  status?: string;
  banned: boolean;
  lastActivity: Date;
  referrer?: string;
  taskPoints: number;
  tonBalance: string; // Decimal as string for safe serialization
  starsBalance: number;
  referralType: 'basic' | 'plus';
  tgLangCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBalance {
  ton: string; // Decimal as string
  stars: number;
}

export interface UserStats {
  totalBets: number;
  totalWon: string; // Decimal as string
  totalLost: string; // Decimal as string
  biggestWin: string; // Decimal as string
  winRate: number; // Percentage
}
