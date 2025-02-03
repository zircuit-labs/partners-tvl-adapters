import { CHAINS, PROTOCOLS, SUBGRAPH_URLS } from './config';

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

const paginatedQuery = async <T>(
  subgraphUrl: string,
  queryTemplate: string,
  blockNumber: number,
  resultKey: string,
): Promise<T[]> => {
  let skip = 0;
  let fetchNext = true;
  let result: T[] = [];
  const PAGE_SIZE = 1000;

  while (fetchNext) {
    const query = queryTemplate
      .replace('{{skip}}', skip.toString())
      .replace('{{blockNumber}}', blockNumber.toString())
      .replace('{{limit}}', PAGE_SIZE.toString());

    const response = await fetch(subgraphUrl, {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    const items = data.data[resultKey];

    result.push(...items);

    fetchNext = items.length === PAGE_SIZE;
    if (fetchNext) {
      skip += PAGE_SIZE;
    }
  }

  return result;
};

export interface LiquidityPosition {
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

export interface User {
  id: string;
  liquidityPositions: LiquidityPosition[];
}

export const getBlockTimestamp = async (blockNumber: number): Promise<number> => {
  const query = `query TimestampForBlock {
    blocks(
      first: 1
      orderBy: timestamp
      orderDirection: desc
      where: {number_lte: ${blockNumber}}
    ) {
      id
      number
      timestamp
    }
  }`;

  const response = await fetch(SUBGRAPH_URLS[CHAINS.ZIRCUIT][PROTOCOLS.BLOCKS], {
    method: 'POST',
    body: JSON.stringify({ query }),
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await response.json();
  return Number(data.data.blocks[0].timestamp);
};

export const getUsersWithLiquidityPositions = async (
  blockNumber: number,
  chainId: CHAINS,
  protocol: PROTOCOLS,
  minAmount = 0,
): Promise<{ users: User[]; timestamp: number }> => {
  const subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
  const blockQuery = blockNumber !== 0 ? `block: {number: ${blockNumber}}` : '';
  const amountQuery = minAmount !== 0 ? `where: {liquidityPositions_: {amount_gte: ${minAmount}}}` : '';

  const queryTemplate = `{
        users(
            ${blockQuery}
            first: {{limit}},
            skip: {{skip}}
            ${amountQuery}
        ) {
            id
            liquidityPositions {
                id
                gauge {
                    id
                    token0 {
                        symbol
                        id
                    }
                    token1 {
                        symbol
                        id
                    }
                    pool
                }
                amount
                userToken0
                userToken1
                userToken0Decimals
                userToken1Decimals
            }
        }
    }`;

  const users = await paginatedQuery<User>(subgraphUrl, queryTemplate, blockNumber, 'users');

  const timestamp = await getBlockTimestamp(blockNumber);

  return { users, timestamp };
};
