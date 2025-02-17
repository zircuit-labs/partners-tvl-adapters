import { createPublicClient, http, PublicClient } from 'viem';
import { zircuit } from 'viem/chains';
import {
  CHAINS, CSVRow,
  PositionData, TokenBalance,
} from './sdk/config';
import {
  processTokenBalance,
  writeCSVOutput,
  prepareBlockNumbersArr,
  Semaphore,
} from './sdk/utils';
import {
  getUserClassicPositions,
  getBlockTimestamp,
} from './sdk/subgraphDetails';

// Constants
const BATCH_SIZE = 40; // Process 40 blocks every 10 seconds
const RATE_LIMIT_WINDOW = 10000; // 10 seconds in ms
const INITIAL_BLOCK = 1369131; // Block where we start to pick up data
const INTERVAL = 1800; // Hourly interval, Zircuit block time is 2 seconds
const OUTPUT_FILE = '../out/tvl-snapshot-zuit.csv';

const processPositionData = async (block: number): Promise<PositionData | null> => {
  try {
    const timestamp = await getBlockTimestamp(block);

    const classicPositions = await getUserClassicPositions(block, CHAINS.ZIRCUIT);

    if (
        classicPositions.length === 0
    ) {
      console.log(`No data found for block ${block}, skipping...`);
      return null;
    }

    const pairs = [
      ...new Set([
        ...classicPositions.map((pos) => pos.pair),
      ]),
    ];

    return {
      block,
      timestamp,
      pairs,
      classicPositions,
    };
  } catch (error) {
    console.error(`Error processing block ${block}:`, error);
    return null;
  }
};

const processPositions = (positionData: PositionData): TokenBalance[] => {
  const balances: TokenBalance[] = [];
  // Process classic positions
  for (const pos of positionData.classicPositions) {
    const userId = pos.id.split('-')[0];
    const token0Balance = processTokenBalance(pos.token0.balance, userId, pos.token0.address, pos.pair);
    const token1Balance = processTokenBalance(pos.token1.balance, userId, pos.token1.address, pos.pair);

    if (token0Balance) balances.push(token0Balance);
    if (token1Balance) balances.push(token1Balance);
  }
  return balances;
};

const processBlockBatch = async (blocks: number[], client: PublicClient): Promise<CSVRow[]> => {
  const semaphore = new Semaphore(BATCH_SIZE);

  const promises = blocks.map(async block => {
    await semaphore.acquire();
    try {
      const positionData = await processPositionData(block);
      if (!positionData) return [];

      const balances = processPositions(positionData);

      return balances.map((balance) => ({
        ...balance,
        block: positionData.block,
        timestamp: positionData.timestamp,
      }));
    } catch (error) {
      console.error(`Error processing block ${block}:`, error);
      return [];
    } finally {
      semaphore.release();
    }
  });

  const batchResults = await Promise.all(promises);
  return batchResults.flat();
};

const getData = async () => {
  const allBalances: CSVRow[] = [];
  console.log('Starting TVL snapshot generation...');

  try {
    const client = createPublicClient({ chain: zircuit, transport: http() });
    const END_BLOCK = Number(await client.getBlockNumber());
    const snapshotBlocks = prepareBlockNumbersArr(INITIAL_BLOCK, INTERVAL, END_BLOCK);

    console.log(`Will process ${snapshotBlocks.length} blocks in batches of ${BATCH_SIZE}`);

    // Process blocks in batches
    for (let i = 0; i < snapshotBlocks.length; i += BATCH_SIZE) {
      const batchBlocks = snapshotBlocks.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(snapshotBlocks.length/BATCH_SIZE)}`);

      const batchBalances = await processBlockBatch(batchBlocks, client as PublicClient);
      allBalances.push(...batchBalances);

      // Wait for rate limit window if not the last batch
      if (i + BATCH_SIZE < snapshotBlocks.length) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_WINDOW));
      }
    }

    await writeCSVOutput(allBalances, OUTPUT_FILE);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
};

getData()
    .then(() => console.log('Done'))
    .catch(console.error);
