import fs from 'fs';
import path from 'path';
import { write } from 'fast-csv';
import { CSVRow, TokenBalance, RELEVANT_PAIRS, GENESIS_BLOCK, INTERVAL } from './config';
import { PublicClient } from 'viem';

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

export const writeCSVOutput = async (rows: CSVRow[], outputFile: string): Promise<unknown> => {
  const outputDir = path.resolve(__dirname, '../../out');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, path.basename(outputFile));
  const ws = fs.createWriteStream(outputPath);

  return new Promise<void>((resolve, reject) => {
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

export const getEndBlock = async (client: PublicClient, endBlockInput: number | undefined): Promise<number> => {
  const latestBlock = endBlockInput ? endBlockInput : await client.getBlockNumber()
  const endBlockDifference = Number(latestBlock) - GENESIS_BLOCK;
  const roundedEndDifference = Math.floor(endBlockDifference / INTERVAL) * INTERVAL;
  return GENESIS_BLOCK + roundedEndDifference;
};

export const getInitialBlock = (initialBlockInput: number | undefined): number => {
  const initialBlockDifference = initialBlockInput ? initialBlockInput - GENESIS_BLOCK : 0;
  const roundedInitialDifference = Math.floor(initialBlockDifference / INTERVAL) * INTERVAL;
  return GENESIS_BLOCK + roundedInitialDifference;
};
