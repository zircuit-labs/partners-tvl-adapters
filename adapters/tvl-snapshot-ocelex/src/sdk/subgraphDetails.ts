import {
  CHAINS,
  PROTOCOLS,
  SUBGRAPH_URLS,
  UserFormattedPosition,
  ConcentratedPosition,
  GaugeLiquidityPositionByUser,
  PreMiningPositionByUser,
} from './config';
import { parseUnits } from 'viem';
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

export const getUsersWithGaugeLiquidityPositions = async (
  blockNumber: number,
  chainId: CHAINS,
  minAmount = 0,
): Promise<GaugeLiquidityPositionByUser[]> => {
  const subgraphUrl = SUBGRAPH_URLS[chainId][PROTOCOLS.OCELEX_HELPER];
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

  const positions = await paginatedQuery<GaugeLiquidityPositionByUser>(
    subgraphUrl,
    queryTemplate,
    blockNumber,
    'users',
  );
  return positions;
};

export const getUserPreMiningPositions = async (
  blockNumber: number,
  chainId: CHAINS,
  minAmount = 0,
): Promise<PreMiningPositionByUser[]> => {
  const subgraphUrl = SUBGRAPH_URLS[chainId][PROTOCOLS.OCELEX_HELPER];
  const blockQuery = blockNumber !== 0 ? `block: {number: ${blockNumber}}` : '';
  const amountQuery = minAmount !== 0 ? `where: {liquidityPositions_: {amount_gte: ${minAmount}}}` : '';

  const queryTemplate = `{
    preMiningUsers(
      ${blockQuery}
      first: {{limit}},
      skip: {{skip}}
      ${amountQuery}
    ) {
      id
      liquidityPositions {
        id
        premining {
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

  const positions = await paginatedQuery<PreMiningPositionByUser>(
    subgraphUrl,
    queryTemplate,
    blockNumber,
    'preMiningUsers',
  );
  return positions;
};

export const getUserClassicPositions = async (
  blockNumber: number,
  chainId: CHAINS,
): Promise<UserFormattedPosition[]> => {
  const subgraphUrl = SUBGRAPH_URLS[chainId][PROTOCOLS.OCELEX_CLASSIC_POOLS];
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

  return positions.map((position) => {
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

const getConcentratedPositionReserves = (position: ConcentratedPosition) => {
  const liquidity = +position.liquidity;
  const _sqrtPrice = +position.pool.sqrtPrice;
  const currentTick = +position.pool.tick;
  const tickLower = +position.tickLower.tickIdx;
  const tickUpper = +position.tickUpper.tickIdx;

  let reserve0 = 0n;
  let reserve1 = 0n;

  if (liquidity === 0) {
    return { reserve0, reserve1 };
  }

  const sqrtRatioA = Math.sqrt(1.0001 ** tickLower);
  const sqrtRatioB = Math.sqrt(1.0001 ** tickUpper);
  const sqrtPrice = _sqrtPrice / 2 ** 96;

  // Only return active TVL
  if (currentTick >= tickLower && currentTick < tickUpper) {
    reserve0 = BigInt(Math.floor(liquidity * ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB))));
    reserve1 = BigInt(Math.floor(liquidity * (sqrtPrice - sqrtRatioA)));
  }

  return { reserve0, reserve1 };
};

export const getUserConcentratedPositions = async (
  blockNumber: number,
  chainId: CHAINS,
): Promise<UserFormattedPosition[]> => {
  const subgraphUrl = SUBGRAPH_URLS[chainId][PROTOCOLS.OCELEX_CONCENTRATED_POOLS];
  const queryTemplate = `{
    positions(
      first: {{limit}},
      skip: {{skip}},
      where: { liquidity_gt: 0 },
      block: { number: {{blockNumber}} }
    ) {
      liquidity
      owner
      pool {
        id
        sqrtPrice
        tick
        token0 {
          id
          decimals
        }
        token1 {
          id
          decimals
        }
      }
      tickLower {
        tickIdx
      }
      tickUpper {
        tickIdx
      }
    }
  }`;

  const positions = await paginatedQuery<ConcentratedPosition>(subgraphUrl, queryTemplate, blockNumber, 'positions');

  return positions.map((position) => {
    const { reserve0, reserve1 } = getConcentratedPositionReserves(position);

    return {
      id: position.owner,
      amount: position.liquidity,
      token0: {
        address: position.pool.token0.id,
        balance: reserve0.toString(),
      },
      token1: {
        address: position.pool.token1.id,
        balance: reserve1.toString(),
      },
      pair: position.pool.id,
    };
  });
};
