import fs from 'fs';
import path from 'path';
import { write } from 'fast-csv';
import { CSVRow, TokenBalance } from './config';



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