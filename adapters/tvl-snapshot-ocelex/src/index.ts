import { createPublicClient, http } from 'viem';
import { zircuit } from 'viem/chains';
import { CHAINS, CSVRow, TokenBalance, BlockData } from './sdk/config';
import { processTokenBalance, aggregateBalances, writeCSVOutput, prepareBlockNumbersArr } from './sdk/utils';
import {
  getUserClassicPositions,
  getUserConcentratedPositions,
  getUsersWithGaugeLiquidityPositions,
  getBlockTimestamp,
  getUserPreMiningPositions,
} from './sdk/subgraphDetails';

// Constants
const INITIAL_BLOCK = 4904075; // Block where we start to pick up data
const INTERVAL = 1800; // Hourly interval, Zircuit block time is 2 seconds
const OUTPUT_FILE = '../out/tvl-snapshot-ocelex.csv';

const processBlockData = async (block: number): Promise<BlockData | null> => {
  try {
    const timestamp = await getBlockTimestamp(block);
    const gaugePositions = await getUsersWithGaugeLiquidityPositions(block, CHAINS.ZIRCUIT);
    const classicPositions = await getUserClassicPositions(block, CHAINS.ZIRCUIT);
    const concentratedPositions = await getUserConcentratedPositions(block, CHAINS.ZIRCUIT);
    const preMiningPositions = await getUserPreMiningPositions(block, CHAINS.ZIRCUIT);

    if (gaugePositions.length === 0 && classicPositions.length === 0 && 
        concentratedPositions.length === 0 && preMiningPositions.length === 0) {
      console.log(`No data found for block ${block}, skipping...`);
      return null;
    }

    return {
      block,
      timestamp,
      gaugePositions,
      classicPositions,
      concentratedPositions,
      preMiningPositions,
    };
  } catch (error) {
    console.error(`Error processing block ${block}:`, error);
    return null;
  }
};

const processPositions = (blockData: BlockData): TokenBalance[] => {
  const balances: TokenBalance[] = [];

  // Process gauge positions
  for (const user of blockData.gaugePositions) {
    for (const pos of user.liquidityPositions) {
      const token0Balance = processTokenBalance(pos.userToken0, user.id, pos.gauge.token0.id);
      const token1Balance = processTokenBalance(pos.userToken1, user.id, pos.gauge.token1.id);

      if (token0Balance) balances.push(token0Balance);
      if (token1Balance) balances.push(token1Balance);
    }
  }

  // Process premining positions
  for (const user of blockData.preMiningPositions) {
    for (const pos of user.liquidityPositions) {
      const token0Balance = processTokenBalance(pos.userToken0, user.id, pos.premining.token0.id);
      const token1Balance = processTokenBalance(pos.userToken1, user.id, pos.premining.token1.id);

      if (token0Balance) balances.push(token0Balance);
      if (token1Balance) balances.push(token1Balance);
    }
  }

  // Process classic positions
  for (const pos of blockData.classicPositions) {
    const userId = pos.id.split('-')[0];
    const token0Balance = processTokenBalance(pos.token0.balance, userId, pos.token0.address);
    const token1Balance = processTokenBalance(pos.token1.balance, userId, pos.token1.address);

    if (token0Balance) balances.push(token0Balance);
    if (token1Balance) balances.push(token1Balance);
  }

  // Process concentrated positions
  for (const pos of blockData.concentratedPositions) {
    const token0Balance = processTokenBalance(pos.token0.balance, pos.id, pos.token0.address);
    const token1Balance = processTokenBalance(pos.token1.balance, pos.id, pos.token1.address);

    if (token0Balance) balances.push(token0Balance);
    if (token1Balance) balances.push(token1Balance);
  }

  return balances;
};

const getData = async () => {
  const allBalances: CSVRow[] = [];
  console.log('Starting TVL snapshot generation...');

  try {
    const client = createPublicClient({ chain: zircuit, transport: http() });
    const END_BLOCK = Number(await client.getBlockNumber());
    const snapshotBlocks = prepareBlockNumbersArr(INITIAL_BLOCK, INTERVAL, END_BLOCK);

    console.log(`Will process ${snapshotBlocks.length} blocks`);

    for (let [index, block] of snapshotBlocks.entries()) {
      console.log(`Processing block ${block}: ${index + 1} of ${snapshotBlocks.length}`);

      const blockData = await processBlockData(block);
      if (!blockData) continue;

      const balances = processPositions(blockData);
      const blockRows: CSVRow[] = balances.map((balance) => ({
        ...balance,
        block: blockData.block,
        timestamp: blockData.timestamp,
      }));

      allBalances.push(...blockRows);
    }

    const aggregatedRows = aggregateBalances(allBalances);
    await writeCSVOutput(aggregatedRows, OUTPUT_FILE);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
};

getData()
  .then(() => console.log('Done'))
  .catch(console.error);
