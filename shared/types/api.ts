// API types for request/response interfaces

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Wallet API types
export interface ConnectWalletRequest {
  walletAddress: string;
}

export interface ConnectWalletResponse {
  walletAddress: string;
  connectedAt: string;
}

export interface DisconnectWalletRequest {
  // No additional data needed, uses auth from headers
}

export interface WalletStatusResponse {
  isConnected: boolean;
  walletAddress?: string;
  connectedAt?: string;
}

// Balance API types
export interface BalanceResponse {
  tonBalance: string; // Decimal as string for precision
  starsBalance: number;
  giftsBalance: number;
}

// Transaction history types
export interface TransactionItem {
  id: string;
  type: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'refund' | 'referral_bonus';
  amount: string; // Decimal as string
  currency: 'ton' | 'stars' | 'gift';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: string; // ISO timestamp
  externalId?: string; // Blockchain tx hash
  metadata?: Record<string, any>;
}

export interface TransactionHistoryResponse {
  transactions: TransactionItem[];
  totalCount: number;
  hasMore: boolean;
}

// Stars payment types
export interface StarsDepositRequest {
  amount: number; // Amount in Stars (integer)
}

export interface StarsDepositResponse {
  invoiceLink: string; // Telegram payment link
  paymentId: string; // Unique payment identifier
}

