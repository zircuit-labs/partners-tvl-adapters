// ENUMs
export const enum CHAINS {
  ZIRCUIT = 48900,
}
export const enum PROTOCOLS {
  ZEROLEND = 0,
}
export const SUBGRAPH_URLS = {
  [CHAINS.ZIRCUIT]: {
    [PROTOCOLS.ZEROLEND]:
      "https://app.sentio.xyz/api/v1/graphql/zerolendxyz/zircuit",
  },
};

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