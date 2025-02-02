import fs from 'fs';
import path from 'path';
import { write } from 'fast-csv';
import { createPublicClient, http } from 'viem';
import { zircuit } from 'viem/chains';
import { CHAINS, PROTOCOLS } from './sdk/config';
import { getUsersWithLiquidityPositions } from './sdk/subgraphDetails';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

interface CSVRow {
  user: string;
  token_address: string;
  block: number;
  token_balance: string;
  timestamp: number;
}

const prepareBlockNumbersArr = (startBlockNumber: number, interval: number, endBlockNumber: number) => {
  const blockNumbers = [];
  let currentBlockNumber = startBlockNumber;
  do {
    blockNumbers.push(currentBlockNumber);
    currentBlockNumber += interval;
  } while (currentBlockNumber <= endBlockNumber);
  return blockNumbers;
};

const INITIAL_BLOCK = 6790475; // Block where we start to pick up data
const INTERVAL = 1800; // Hourly interval, Zircuit block time is 2 seconds

const OUTPUT_FILE = '../out/tvl-snapshot-ocelex.csv';

const getData = async () => {
  const tempRows: CSVRow[] = [];
  console.log('Starting TVL snapshot generation...');

  try {
    // Get the latest block we can query
    const client = createPublicClient({ chain: zircuit, transport: http() });
    const END_BLOCK = Number(await client.getBlockNumber());

    const snapshotBlocks = prepareBlockNumbersArr(INITIAL_BLOCK, INTERVAL, END_BLOCK);
    console.log(`Will process ${snapshotBlocks.length} blocks`);

    for (let [index, block] of snapshotBlocks.entries()) {
      console.log(`Processing block ${block}: ${index + 1} of ${snapshotBlocks.length}`);

      try {
        const { users, timestamp } = await getUsersWithLiquidityPositions(block, CHAINS.ZIRCUIT, PROTOCOLS.OCELEX);

        if (!users || users.length === 0) {
          console.log(`No data found for block ${block}, skipping...`);
          continue;
        }

        for (const user of users) {
          for (const pos of user.liquidityPositions) {
            // Add row for token0
            if (pos.userToken0 !== '0') {
              tempRows.push({
                user: user.id,
                token_address: pos.gauge.token0.id,
                block,
                token_balance: pos.userToken0,
                timestamp,
              });
            }

            // Add row for token1
            if (pos.userToken1 !== '0') {
              tempRows.push({
                user: user.id,
                token_address: pos.gauge.token1.id,
                block,
                token_balance: pos.userToken1,
                timestamp,
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error processing block ${block}:`, error);
        continue;
      }
    }

    // Aggregate balances for same user/token/block combinations
    const aggregatedMap = new Map<string, CSVRow>();
    tempRows.forEach((row) => {
      const key = `${row.user}-${row.token_address}-${row.block}`;
      if (aggregatedMap.has(key)) {
        const existing = aggregatedMap.get(key)!;
        existing.token_balance = (BigInt(existing.token_balance) + BigInt(row.token_balance)).toString();
      } else {
        aggregatedMap.set(key, { ...row });
      }
    });

    const csvRows = Array.from(aggregatedMap.values());

    // Create output directory if it doesn't exist
    const outputDir = path.resolve(__dirname, '../out');
    fs.mkdirSync(outputDir, { recursive: true });

    // Write the CSV output to a file
    const outputPath = path.resolve(__dirname, OUTPUT_FILE);
    const ws = fs.createWriteStream(outputPath);
    write(csvRows, { headers: true })
      .pipe(ws)
      .on('finish', () => {
        console.log(`CSV file has been written to: ${outputPath}`);
        console.log(`Total rows: ${csvRows.length}`);
      });
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
};

getData()
  .then(() => {
    console.log('Done');
  })
  .catch(console.error);
