import fs from 'fs';
import path from 'path';
import { write } from 'fast-csv';
import { CSVRow, TokenBalance, LensResponse } from './config';
import { PublicClient, type Abi } from 'viem';
import { CONTRACTS } from './config';
import { PAIR_API_ABI } from '../sdk/abis/PairAPIABI';

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

export const processTokenBalance = (balance: string, user: string, tokenAddress: string): TokenBalance | null => {
  if (balance === '0') return null;
  return {
    user,
    token_address: tokenAddress,
    token_balance: balance,
  };
};

export const aggregateBalances = (rows: CSVRow[]): CSVRow[] => {
  const aggregatedMap = new Map<string, CSVRow>();
  rows.forEach((row) => {
    const key = `${row.user}-${row.token_address}-${row.block}`;
    if (aggregatedMap.has(key)) {
      const existing = aggregatedMap.get(key)!;
      existing.token_balance = (BigInt(existing.token_balance) + BigInt(row.token_balance)).toString();
    } else {
      aggregatedMap.set(key, { ...row });
    }
  });
  return Array.from(aggregatedMap.values());
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
