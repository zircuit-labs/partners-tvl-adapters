import {
  AMM_TYPES,
  CHAINS,
  PROTOCOLS,
  SUBGRAPH_URLS, UserFormattedPosition,
} from './config';
import { parseUnits } from 'viem';
import { BigNumber } from 'bignumber.js';
import { withRetry } from './utils';

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

    const response = await withRetry(async () => {
      const res = await fetch(subgraphUrl, {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      });

      if (!res.ok) {
        throw new Error(`Subgraph request failed with status ${res.status}`);
      }

      return res;
    });

    const data = await response.json() as any;
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

  return await withRetry(async () => {
    const response = await fetch(SUBGRAPH_URLS[CHAINS.ZIRCUIT][PROTOCOLS.BLOCKS], {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch block timestamp from subgraph: ${response.status}`);
    }

    const data = await response.json();
    return Number(data.data.blocks[0].timestamp);
  });
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
    // Convert to BigInt with consistent scaling factor
    const liquidityTokenBalanceWei = _BigInt(position.liquidityTokenBalance, position.lpToken.decimals);
    const totalSupplyWei = BigInt(position.lpToken.totalSupply);

    // Calculate scaled balance directly with token reserves to maintain precision
    const baseReserveWei = _BigInt(position.pair.baseReserve, position.pair.baseToken.decimals);
    const quoteReserveWei = _BigInt(position.pair.quoteReserve, position.pair.quoteToken.decimals);

    // Calculate user's token amounts using the ratio directly
    const userToken0Balance = baseReserveWei * liquidityTokenBalanceWei / totalSupplyWei;
    const userToken1Balance = quoteReserveWei * liquidityTokenBalanceWei / totalSupplyWei;

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


const fmt = {
  prefix: '',
  groupSize: 0,
  secondaryGroupSize: 0,
  groupSeparator: '',
  decimalSeparator: '.',
  fractionGroupSize: 0,
  fractionGroupSeparator: '\xA0',        // non-breaking space
  suffix: ''
}
function _BigInt(val: string | number, decimals: string | number): bigint {
  const bn = new BigNumber(val)
  return BigInt(parseUnits(bn.toFormat(fmt), Number(decimals)).toString())
}
