import fs from 'fs';
import path from 'path';
import { write } from 'fast-csv';
import { CSVRow, TokenBalance, LensResponse, RELEVANT_PAIRS } from './config';
import { PublicClient, type Abi } from 'viem';
import { CONTRACTS } from './config';
import { PAIR_API_ABI } from './abis/PairAPIABI';

export const getAllPairData = async (
  pairs: string[],
  client: PublicClient,
  blockNumber: number,
): Promise<Record<string, LensResponse>> => {
  const calls = pairs.map((pair) => ({
    address: CONTRACTS.PAIR_LENS as `0x${string}`,
    abi: PAIR_API_ABI as Abi,
    functionName: 'getPair',
    args: [pair, '0x0000000000000000000000000000000000000000'],
  }));

  const lensResponses = await client.multicall({
    contracts: calls,
    blockNumber: blockNumber ? BigInt(blockNumber) : undefined,
  });

  return Object.fromEntries(lensResponses.map((response, index) => [pairs[index], response.result as LensResponse]));
};

export const prepareBlockNumbersArr = (
  startBlockNumber: number,
  interval: number,
  endBlockNumber: number,
): number[] => {
  const blockNumbers: number[] = [];
  let currentBlockNumber = startBlockNumber;
  do {
    blockNumbers.push(currentBlockNumber);
    currentBlockNumber += interval;
  } while (currentBlockNumber <= endBlockNumber);
  return blockNumbers;
};

export const processTokenBalance = (balance: string, user: string, tokenAddress: string, pool: string): TokenBalance | null => {
  if (!balance || BigInt(balance) === 0n) return null;
  return {
    user,
    pool,
    token_address: tokenAddress,
    token_balance: balance,
  };
};

export const writeCSVOutput = async (rows: CSVRow[], outputFile: string): Promise<void> => {
  const outputDir = path.resolve(__dirname, '../../out');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, path.basename(outputFile));
  const ws = fs.createWriteStream(outputPath);

  return new Promise((resolve, reject) => {
    write(rows, { headers: true })
      .pipe(ws)
      .on('finish', () => {
        console.log(`CSV file has been written to: ${outputPath}`);
        console.log(`Total rows: ${rows.length}`);
        resolve();
      })
      .on('error', reject);
  });
};

export class Semaphore {
  private running = 0;
  private queue: (() => void)[] = [];

  constructor(private maxConcurrent: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }

    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}

/**
 * Retry a function with exponential backoff
 * @param fn The function to retry
 * @param maxRetries Maximum number of retries
 * @param initialDelay Initial delay in ms
 * @returns The result of the function
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> => {
  let retries = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      if (retries > maxRetries) {
        throw error;
      }

      const delay = initialDelay * Math.pow(2, retries - 1);
      console.log(`Attempt ${retries} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export const isRelevantPair = (token0: string, token1: string): boolean => {
  return RELEVANT_PAIRS.some(
    (pair) =>
      (pair.token0.toLowerCase() === token0.toLowerCase() && pair.token1.toLowerCase() === token1.toLowerCase()) ||
      (pair.token0.toLowerCase() === token1.toLowerCase() && pair.token1.toLowerCase() === token0.toLowerCase()),
  );
};