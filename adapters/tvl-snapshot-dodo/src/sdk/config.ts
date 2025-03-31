export const enum CHAINS {
    ZIRCUIT = 48900,
}
export const enum PROTOCOLS {
    ZUIT = 0,
    BLOCKS = 1,
    SUPSWAP = 2,
    DODOEX = 3,
}

export const enum AMM_TYPES {
    UNISWAPV3 = 0,
    DODO = 1,
}

export const SUBGRAPH_URLS = {
    [CHAINS.ZIRCUIT]: {
        [PROTOCOLS.DODOEX]: {
            [AMM_TYPES.DODO]:
                "https://api.dodoex.io/graph-node-zircuit/subgraphs/name/dodoex/dodoex-v2-zircuit?apikey=graphqldefiLlamadodoYzj5giof",
        },
        [PROTOCOLS.BLOCKS]:
            'https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/blocks/zircuit/gn',
    },
};


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