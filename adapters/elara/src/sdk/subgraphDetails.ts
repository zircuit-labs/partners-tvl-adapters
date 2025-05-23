import BigNumber from "bignumber.js";
import { CHAINS, PROTOCOLS, SUBGRAPH_URLS } from "./config";
import { withRetry } from "./utils";

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
    args: Record<string, any>,
    resultKey: string // e.g., 'exchangeRates' or 'balanceChanges'
): Promise<T[]> => {
    let skip = 0;
    let fetchNext = true;
    let result: T[] = [];
    const PAGE_SIZE = 1000;

    while (fetchNext) {
        let query = queryTemplate
            .replace('{{skip}}', skip.toString())
            .replace('{{limit}}', PAGE_SIZE.toString());

        for (const [key, value] of Object.entries(args)) {
            query = query.replace(`{{${key}}}`, value.toString());
        }

        const response = await withRetry(async () => {
            const res = await fetch(subgraphUrl, {
                method: "POST",
                body: JSON.stringify({ query }),
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
}

export const getExchangeRatesBeforeBlock = async (
    blockNumber: number,
    chainId: CHAINS,
    protocol: PROTOCOLS,
): Promise<ExchangeRate[]> => {
    const subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
    const queryTemplate = `{
        exchangeRates(orderBy: blockTimestamp, first:{{limit}}, skip:{{skip}}, where: {blockNumber_lte: {{blockNumber}}}) {
            id
            poolAddress
            tokenAddress
            rate
            blockTimestamp
            blockNumber
        }
    }`;

    return paginatedQuery<ExchangeRate>(
        subgraphUrl,
        queryTemplate,
        { blockNumber },
        'exchangeRates'
    );
}

export const getBalanceChangesBeforeBlock = async (
    blockNumber: number,
    chainId: CHAINS,
    protocol: PROTOCOLS,
): Promise<BalanceChange[]> => {
    const subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
    const queryTemplate = `{
        balanceChanges(orderBy: blockTimestamp, first:{{limit}}, skip:{{skip}}, where: {blockNumber_lte: {{blockNumber}}}) {
            id
            token
            user
            amount
            blockTimestamp
            blockNumber
        }
    }`;

    return paginatedQuery<BalanceChange>(
        subgraphUrl,
        queryTemplate,
        { blockNumber },
        'balanceChanges'
    );
}

interface TokenValue {
    value: BigNumber;
    timestamp: number;
}

type UserTokenBalances = Map<string, BigNumber>;
type UsersSnapshots = Map<string, Map<string, TokenValue>>;

export const getBlockTimestamps = async (blocks: number[]): Promise<Record<number, number>> => {
    const BATCH_SIZE = 100; // Process 100 blocks at a time
    const result: Record<number, number> = {};

    // Process blocks in batches
    for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
        const batchBlocks = blocks.slice(i, i + BATCH_SIZE);
        const query = `query TimestampForBlock {
          blocks(
            orderBy: timestamp
            orderDirection: asc
            where: {number_in: ${JSON.stringify(batchBlocks)}}
          ) {
            id
            number
            timestamp
          }
        }`;

        const batchResult = await withRetry(async () => {
          const response = await fetch(SUBGRAPH_URLS[CHAINS.ZIRCUIT][PROTOCOLS.BLOCKS], {
            method: 'POST',
            body: JSON.stringify({ query }),
            headers: { 'Content-Type': 'application/json' },
          });

          if (!response.ok) {
            throw new Error(`Subgraph request failed with status ${response.status}`);
          }

          const data = await response.json();
          return data.data.blocks;
        });

        // Add batch results to the main result object
        batchResult.forEach((block: { number: number; timestamp: number }) => {
          result[block.number] = block.timestamp;
        });

        // Add a small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < blocks.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return result;
  };

export const getLPValueByUser = (
    exchangeRates: ExchangeRate[],
    balanceChanges: BalanceChange[]
): UsersSnapshots => {
    // Sort exchange rates by timestamp to get latest rates
    const sortedRates = exchangeRates.sort((a, b) => Number(b.blockTimestamp) - Number(a.blockTimestamp));
    const result: UsersSnapshots = new Map();
    
    // First calculate final token balances for each user
    const userBalances = new Map<string, UserTokenBalances>();
    
    for (const change of balanceChanges) {
        if (!userBalances.has(change.user)) {
            userBalances.set(change.user, new Map<string, BigNumber>());
        }
        
        const tokenBalances = userBalances.get(change.user)!;
        const currentBalance = tokenBalances.get(change.token) || BigNumber(0);
        const amount = BigNumber(change.amount.toString());
        tokenBalances.set(change.token, currentBalance.plus(amount));
    }
    
    // Then convert final balances using latest exchange rates
    for (const [user, tokenBalances] of userBalances) {
        const userSnapshots: Map<string, TokenValue> = new Map();
        result.set(user, userSnapshots);

        for (const [token, balance] of tokenBalances) {
            // Get latest rate for this token
            const latestRate = sortedRates.find(rate => rate.poolAddress === token);
            if (!latestRate) continue;
            
            const rate = BigNumber(latestRate.rate.toString());

            const value = balance
                .multipliedBy(rate)
                .dividedBy(new BigNumber(10).pow(18));
                
            userSnapshots.set(
                latestRate.tokenAddress,
                {
                    value,
                    timestamp: Number(latestRate.blockTimestamp)
                }
            );
        }
    }
    
    return result;
}