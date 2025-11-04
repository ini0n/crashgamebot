export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface AuthRequest {
    initData: string;
}
export interface AuthResponse {
    user: import('./user').User;
}
export interface DepositRequest {
    amount: string;
    currency: 'ton' | 'stars';
    paymentMethod?: string;
}
export interface WithdrawRequest {
    amount: string;
    currency: 'ton' | 'stars';
    destination: string;
}
export interface TransactionHistory {
    id: string;
    type: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'referral_bonus' | 'gift_conversion';
    amount: string;
    currency: 'ton' | 'stars' | 'gift';
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    createdAt: Date;
    metadata?: Record<string, any>;
}
export interface Gift {
    id: string;
    telegramGiftId: number;
    name: string;
    stickerFileId: string;
    originalPrice: number;
    ourPrice: number;
    convertStars: number;
    limited: boolean;
    availabilityTotal?: number;
    availabilityRemains?: number;
    active: boolean;
}
export interface UserGift {
    id: string;
    chatId: string;
    gift: Gift;
    telegramMessageId: number;
    receivedAt: Date;
    displayOnProfile: boolean;
    converted: boolean;
}
export interface ReferralStats {
    totalReferrals: number;
    activeReferrals: number;
    totalEarnings: {
        ton: string;
        stars: number;
    };
    thisMonthEarnings: {
        ton: string;
        stars: number;
    };
    referralType: 'basic' | 'plus';
}
export interface ReferralEarning {
    id: string;
    referredUsername?: string;
    amount: string;
    currency: 'ton' | 'stars' | 'gift';
    type: 'deposit_commission' | 'loss_commission';
    createdAt: Date;
}
//# sourceMappingURL=api.d.ts.map