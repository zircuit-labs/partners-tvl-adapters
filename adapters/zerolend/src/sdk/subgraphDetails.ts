import { CHAINS, PROTOCOLS, SUBGRAPH_URLS } from "./config";
import { withRetry } from "./utils";
export interface ATokenBalanceHistory {
  currentATokenBalance: string;
  timestamp: string;
}
export interface UserReserveData {
  user: {
    id: string;
  };
  reserve: {
    underlyingAsset: string;
    symbol: string;
  };
  aTokenBalanceHistory: ATokenBalanceHistory[];
}

export interface QueryResponse {
  userReserves: UserReserveData[];
}

export const getUserReservesWithHistory = async (
  chainId: CHAINS,
  protocol: PROTOCOLS
): Promise<UserReserveData[]> => {
  const subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
  return paginatedQuery(
    subgraphUrl,
    buildUserReservesQuery(),
    "userReserves");
};

const buildUserReservesQuery = () => {
  return `query UserReserves($skip: Int!, $limit: Int!) {
    userReserves(skip: $skip, first: $limit) {
      user {
        id
      }
      reserve {
        underlyingAsset
        symbol
      }
      aTokenBalanceHistory {
        currentATokenBalance
        timestamp
      }
    }
  }`;
};

const paginatedQuery = async <T>(
  subgraphUrl: string,
  queryTemplate: string,
  resultKey: string
): Promise<T[]> => {
  let skip = 0;
  let fetchNext = true;
  let result: T[] = [];
  const PAGE_SIZE = 1000;
  let cnt = 1;
  while (fetchNext) {
    const variables = {
      skip: skip,
      limit: PAGE_SIZE,
    };

    const response = await withRetry(async () => {
      const res = await fetch(subgraphUrl, {
        method: "POST",
        body: JSON.stringify({ query: queryTemplate, variables }),
        headers: { "Content-Type": "application/json" },
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
