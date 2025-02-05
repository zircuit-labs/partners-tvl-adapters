// ENUMs
export const enum CHAINS {
  ZIRCUIT = 48900,
}
export const enum PROTOCOLS {
  BLOCKS = 0,
  OCELEX_CLASSIC_POOLS = 1,
  OCELEX_CONCENTRATED_POOLS = 2,
  OCELEX_HELPER = 3,
}
export const enum CONTRACTS {
  PAIR_LENS = '0x0b4158e310AE236042203322f618Cde047289b3F',
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
    [PROTOCOLS.OCELEX_HELPER]:
      'https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/ocelex-helper/0.0.2/gn',
  },
};

// INTERFACES
export interface GaugeLiquidityPosition {
  id: string;
  gauge: {
    id: string;
    pool: string;
    token0: {
      symbol: string;
      id: string;
    };
    token1: {
      symbol: string;
      id: string;
    };
  };
  amount: string;
  userToken0: string;
  userToken1: string;
  userToken0Decimals: string;
  userToken1Decimals: string;
}

export interface PreMiningPosition {
  id: string;
  premining: {
    id: string;
    pool: string;
    token0: {
      symbol: string;
      id: string;
    };
    token1: {
      symbol: string;
      id: string;
    };
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

export interface PreMiningPositionByUser {
  id: string;
  liquidityPositions: PreMiningPosition[];
}

export interface CSVRow {
  user: string;
  token_address: string;
  block: number;
  token_balance: string;
  timestamp: number;
}

export type UserFormattedPosition = {
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
  pair: string;
};

export interface ConcentratedPosition {
  liquidity: string;
  owner: string;
  pool: {
    id: string;
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

export interface TokenBalance {
  user: string;
  token_address: string;
  token_balance: string;
}

export interface PositionData {
  block: number;
  timestamp: number;
  pairs: string[];
  gaugePositions: GaugeLiquidityPositionByUser[];
  classicPositions: UserFormattedPosition[];
  concentratedPositions: UserFormattedPosition[];
  preMiningPositions: PreMiningPositionByUser[];
}

export interface LensResponse {
  pair_address: string;
  symbol: string;
  name: string;
  decimals: bigint;
  stable: boolean;
  total_supply: bigint;
  token0: string;
  token0_symbol: string;
  token0_decimals: bigint;
  reserve0: bigint;
  claimable0: string;
  token1: string;
  token1_symbol: string;
  token1_decimals: bigint;
  reserve1: bigint;
  claimable1: bigint;
  gauge: string;
  gauge_total_supply: bigint;
  fee: string;
  bribe: string;
  emissions: bigint;
  emissions_token: string;
  emissions_token_decimals: bigint;
  account_lp_balance: bigint;
  account_token0_balance: bigint;
  account_token1_balance: bigint;
  account_gauge_balance: bigint;
  account_locked_gauge_balance: bigint;
  account_lock_end: bigint;
  account_gauge_earned: bigint;
  userAddress: string;
}
