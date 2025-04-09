import { GENESIS_BLOCK, INTERVAL } from "./config";
import { PublicClient } from 'viem';

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