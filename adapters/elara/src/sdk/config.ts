export const enum CHAINS {
    ZIRCUIT = 48900,
}
export const enum PROTOCOLS {
    ELARA = 0,
}

export const SUBGRAPH_URLS = {
    [CHAINS.ZIRCUIT]: {
        [PROTOCOLS.ELARA]: "https://api.goldsky.com/api/public/project_cm6fyrqv3njua01th4nak8bze/subgraphs/elara/v1/gn"
    }
}

export const GENESIS_BLOCK = 6026314;
export const INTERVAL = 1800;

export const OUTPUT_FILE = '../out/tvl-snapshot-elara.csv';