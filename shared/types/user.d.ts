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
    tonBalance: string;
    starsBalance: number;
    referralType: 'basic' | 'plus';
    createdAt: Date;
    updatedAt: Date;
}
export interface UserBalance {
    ton: string;
    stars: number;
}
export interface UserStats {
    totalBets: number;
    totalWon: string;
    totalLost: string;
    biggestWin: string;
    winRate: number;
}
//# sourceMappingURL=user.d.ts.map