// INTERFACES
export interface CSVRow extends TokenBalance {
  block: number;
  timestamp: number;
}

export interface TokenBalance {
  user: string;
  token_address: string;
  token_balance: string;
}
