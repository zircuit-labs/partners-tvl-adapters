import {
    CHAINS,
    PROTOCOLS,
    SUBGRAPH_URLS, UserFormattedPosition,
} from './config';
import { parseUnits } from 'viem';
import { withRetry, isRelevantPair } from './utils';

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

    return await withRetry(async () => {
        const response = await fetch(SUBGRAPH_URLS[CHAINS.ZIRCUIT][PROTOCOLS.BLOCKS], {
            method: 'POST',
            body: JSON.stringify({ query }),
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`Subgraph request failed with status ${response.status}`);
        }

      const data = await response.json();
      return Number(data.data.blocks[0].timestamp);
    });
};


export const getUserClassicPositions = async (
    blockNumber: number,
    chainId: CHAINS,
): Promise<UserFormattedPosition[]> => {
    const subgraphUrl = SUBGRAPH_URLS[chainId][PROTOCOLS.ZUIT];
    const queryTemplate = `{
    liquidityPositions(
      first: {{limit}},
      skip: {{skip}},
      where: { liquidityTokenBalance_gt: 0 },
      block: { number: {{blockNumber}} }
    ) {
      liquidityTokenBalance
      user {
        id
      }
      pair {
        id
        totalSupply
        reserveUSD
        reserve0
        reserve1
        token0 {
          id
          decimals
        }
        token1 {
          id
          decimals
        }
      }
    }
  }`;

    const positions = await paginatedQuery<any>(subgraphUrl, queryTemplate, blockNumber, 'liquidityPositions');

    const filteredPositions = positions.filter((position) => isRelevantPair(position.pair.token0.id, position.pair.token1.id));

    return filteredPositions.map((position) => {
        const userShare =
            (BigInt(parseUnits(position.liquidityTokenBalance, 18).toString()) * BigInt(1e18)) /
            BigInt(parseUnits(position.pair.totalSupply, 18).toString());
        const userToken0Balance =
            (BigInt(parseUnits(position.pair.reserve0, Number(position.pair.token0.decimals)).toString()) * userShare) /
            BigInt(1e18);
        const userToken1Balance =
            (BigInt(parseUnits(position.pair.reserve1, Number(position.pair.token1.decimals)).toString()) * userShare) /
            BigInt(1e18);

        return {
            id: position.user.id,
            amount: position.liquidityTokenBalance,
            token0: {
                address: position.pair.token0.id,
                balance: userToken0Balance.toString(),
            },
            token1: {
                address: position.pair.token1.id,
                balance: userToken1Balance.toString(),
            },
            pair: position.pair.id,
        };
    });
};

