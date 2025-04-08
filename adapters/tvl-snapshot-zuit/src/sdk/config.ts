export const enum CHAINS {
    ZIRCUIT = 48900,
}
export const enum PROTOCOLS {
    ZUIT = 0,
    BLOCKS = 1,
}

export const SUBGRAPH_URLS = {
    [CHAINS.ZIRCUIT]: {
        [PROTOCOLS.ZUIT]: "https://graph1.syncswap.xyz/subgraphs/name/zuit/zuit-zircuit",
        [PROTOCOLS.BLOCKS]:
            'https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/blocks/zircuit/gn',
    }
}

// Relevant Token Combinations to Track
const USDC_ADDRESS = '0x3b952c8c9c44e8fe201e2b26f6b2200203214cff';
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
const ZRC_ADDRESS = '0xfd418e42783382e86ae91e445406600ba144d162';
const WBTC_ADDRESS = '0x19df5689cfce64bc2a55f7220b0cd522659955ef';
const USDT_ADDRESS = '0x46dda6a5a559d861c06ec9a95fb395f5c3db0742';
export const RELEVANT_PAIRS: {
  token0: string;
  token1: string;
}[] = [
  {
    token0: WETH_ADDRESS,
    token1: ZRC_ADDRESS,
  },
  {
    token0: WETH_ADDRESS,
    token1: WBTC_ADDRESS,
  },
  {
    token0: WETH_ADDRESS,
    token1: USDT_ADDRESS,
  },
  {
    token0: USDC_ADDRESS,
    token1: USDT_ADDRESS,
  },
];

export interface CSVRow extends TokenBalance {
    block: number;
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

export interface TokenBalance {
    user: string;
    pool: string;
    token_address: string;
    token_balance: string;
}

export interface PositionData {
    block: number;
    timestamp: number;
    pairs: string[];
    classicPositions: UserFormattedPosition[];
}