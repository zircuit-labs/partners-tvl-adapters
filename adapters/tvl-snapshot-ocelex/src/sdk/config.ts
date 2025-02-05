// ENUMs
export const enum CHAINS {
  ZIRCUIT = 48900,
}
export const enum PROTOCOLS {
  BLOCKS = 0,
  OCELEX_CLASSIC_POOLS = 1,
  OCELEX_CONCENTRATED_POOLS = 2,
  OCELEX_GAUGES = 3,
}

// SUBGRAPH URLs
export const SUBGRAPH_URLS = {
  [CHAINS.ZIRCUIT]: {
    [PROTOCOLS.BLOCKS]:
      'https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/blocks/zircuit/gn',
    [PROTOCOLS.OCELEX_CLASSIC_POOLS]:
      'https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/ocelex/1.0.0/gn',
    [PROTOCOLS.OCELEX_CONCENTRATED_POOLS]:
      'https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/ocelex-cl/1.0.0/gn',
    [PROTOCOLS.OCELEX_GAUGES]:
      'https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/ocelex-helper/0.0.1/gn',
  },
};

// INTERFACES
export interface ExchangeRate {
  id: string;
  poolAddress: string;
  tokenAddress: string;
  rate: bigint;
  blockTimestamp: bigint;
  blockNumber: bigint;
}

export interface BalanceChange {
  id: string;
  token: string;
  user: string;
  amount: bigint;
  blockTimestamp: bigint;
  blockNumber: bigint;
}

export interface GaugeLiquidityPosition {
  id: string;
  gauge: {
    id: string;
    token0: {
      symbol: string;
      id: string;
    };
    token1: {
      symbol: string;
      id: string;
    };
    pool: string;
  };
  amount: string;
  userToken0: string;
  userToken1: string;
  userToken0Decimals: string;
  userToken1Decimals: string;
}

export interface GaugeLiquidityPositionByUser {
  id: string;
  liquidityPositions: GaugeLiquidityPosition[];
}

export interface CSVRow {
  user: string;
  token_address: string;
  block: number;
  token_balance: string;
  timestamp: number;
}

export type UserClassicPosition = {
  id: string;
  amount: bigint;
  token0: {
    address: string;
    balance: string;
  };
  token1: {
    address: string;
    balance: string;
  };
};

export interface ConcentratedPosition {
  liquidity: string;
  owner: string;
  pool: {
    sqrtPrice: string;
    tick: string;
    token0: {
      id: string;
      decimals: string;
    };
    token1: {
      id: string;
      decimals: string;
    };
  };
  tickLower: {
    tickIdx: string;
  };
  tickUpper: {
    tickIdx: string;
  };
}

export interface UserConcentratedPosition {
  id: string;
  amount: string;
  token0: {
    address: string;
    balance: string;
  };
  token1: {
    address: string;
    balance: string;
  };
}

export interface TokenBalance {
  user: string;
  token_address: string;
  token_balance: string;
}

export interface BlockData {
  block: number;
  timestamp: number;
  gaugePositions: GaugeLiquidityPositionByUser[];
  classicPositions: UserClassicPosition[];
  concentratedPositions: UserConcentratedPosition[];
}
