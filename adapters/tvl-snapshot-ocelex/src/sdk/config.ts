export const enum CHAINS {
  ZIRCUIT = 48900,
}
export const enum PROTOCOLS {
  BLOCKS = 0,
  OCELEX = 1,
}

export const SUBGRAPH_URLS = {
  [CHAINS.ZIRCUIT]: {
    [PROTOCOLS.BLOCKS]:
      "https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/blocks/zircuit/gn",
    [PROTOCOLS.OCELEX]:
      "https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/ocelex-helper/0.0.1/gn",
  },
};
