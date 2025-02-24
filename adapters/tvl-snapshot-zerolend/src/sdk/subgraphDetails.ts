import { CHAINS, PROTOCOLS, SUBGRAPH_URLS } from "./config";

export interface UserReserveData {
  user: {
    id: string;
  };
  currentATokenBalance: string;
  reserve: {
    underlyingAsset: string;
    symbol: string;
  };
  lastUpdateTimestamp: string;
}

export interface QueryResponse {
  userReserves: UserReserveData[];
}

export const getUserReservesForBlock = async (
  chainId: CHAINS,
  protocol: PROTOCOLS,
  blockNumber: number
): Promise<UserReserveData[]> => {
  const subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
  return paginatedQuery<UserReserveData>(
    subgraphUrl,
    buildUserReservesQuery(),
    blockNumber,
    "userReserves"
  );
};

const buildUserReservesQuery = () => {
  return `query Reserve($skip: Int!, $limit: Int!, $blockNumber: Int!) {
        userReserves(skip: $skip, first: $limit, block: {number_gte: $blockNumber}) {
            user {
                id
            }
            currentATokenBalance
            reserve {
                underlyingAsset
                symbol
            }
            lastUpdateTimestamp
        }
    }`;
};

const paginatedQuery = async <T>(
  subgraphUrl: string,
  queryTemplate: string,
  blockNumber: number,
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
      blockNumber: blockNumber,
    };

    const response = await fetch(subgraphUrl, {
      method: "POST",
      body: JSON.stringify({ query: queryTemplate, variables }),
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();

    if (!data.data || !data.data[resultKey]) {
      console.error("Error in response:", data);
      break;
    }

    const items = data.data[resultKey];
    result.push(...items);

    fetchNext = items.length === PAGE_SIZE;
    if (fetchNext) {
      skip += PAGE_SIZE;
    }
  }

  return result;
};
