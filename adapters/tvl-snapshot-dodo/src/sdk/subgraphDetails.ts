import {
  AMM_TYPES,
  CHAINS,
  PROTOCOLS,
  SUBGRAPH_URLS, UserFormattedPosition,
} from './config';
import { parseUnits } from 'viem';

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

export const getUserClassicPositions = async (
  blockNumber: number,
  chainId: CHAINS,
  protocol: PROTOCOLS,
  ammType: AMM_TYPES
): Promise<UserFormattedPosition[]> => {
  const subgraphUrl = (SUBGRAPH_URLS as any)[chainId][protocol][ammType];
  const queryTemplate = `{
        liquidityPositions(
          first: {{limit}},
          skip: {{skip}},
          where: { liquidityTokenBalance_gt: 0 },
          block: { number: {{blockNumber}} }
        ) {
          id
          user {
              id
          }
          pair {
              id
              type
              baseReserve
              quoteReserve
              baseToken {
                  id
                  decimals
                  name
                  symbol
              }
              quoteToken {
                  id
                  decimals
                  name
                  symbol
              }
              baseLpToken {
                  id
                  decimals
                  name
                  symbol
                  totalSupply
              }
              quoteLpToken {
                  id
                  decimals
                  name
                  symbol
                  totalSupply
              }
          }
          lpToken {
              id
              decimals
              name
              symbol
              totalSupply
          }
          liquidityTokenBalance
          liquidityTokenInMining
          lastTxTime
          updatedAt
      }
      _meta {
          block {
          number
          }
      }
      }
`;
  const positions = await paginatedQuery<any>(subgraphUrl, queryTemplate, blockNumber, 'liquidityPositions');

  return positions.map((position) => {
    const userShare =
      (BigInt(parseUnits(position.liquidityTokenBalance, 18).toString()) * BigInt(1e18)) /
      BigInt(parseUnits(position.lpToken.totalSupply, Number(position.lpToken.decimals)).toString());
    const userToken0Balance =
      (BigInt(parseUnits(position.pair.baseReserve, Number(position.pair.baseToken.decimals)).toString()) * userShare) /
      BigInt(1e18);
    const userToken1Balance =
      (BigInt(parseUnits(position.pair.quoteReserve, Number(position.pair.quoteToken.decimals)).toString()) * userShare) /
      BigInt(1e18);

    return {
      id: position.user.id,
      amount: position.liquidityTokenBalance,
      token0: {
        address: position.pair.baseToken.id,
        balance: userToken0Balance.toString(),
      },
      token1: {
        address: position.pair.quoteToken.id,
        balance: userToken1Balance.toString(),
      },
      pair: position.pair.id,
    };
  });
};
