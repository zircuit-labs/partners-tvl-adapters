export const enum CHAINS {
  ZIRCUIT = 48900,
}
export const enum PROTOCOLS {
  ZEROLEND = 0,
}
export const SUBGRAPH_URLS = {
  [CHAINS.ZIRCUIT]: {
    [PROTOCOLS.ZEROLEND]:
      "https://api.goldsky.com/api/public/project_clsk1wzatdsls01wchl2e4n0y/subgraphs/zerolend-zircuit/1.0.0/gn",
  },
};
