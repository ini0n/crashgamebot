// Типы для депозитной системы

export interface DepositRequest {
  amount: string;
}

export interface DepositResponse {
  depositAddress: string;
  amount: string;
  comment: string;
  network: string;
}

