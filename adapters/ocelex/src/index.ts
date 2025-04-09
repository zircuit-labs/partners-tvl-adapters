import { createPublicClient, http, PublicClient } from 'viem';
import { zircuit } from 'viem/chains';
import {
  CHAINS,
  CSVRow,
  TokenBalance,
  PositionData,
  GaugeLiquidityPosition,
  PreMiningPosition,
  LensResponse,
  INTERVAL,
  OUTPUT_FILE,
} from './sdk/config';
import {
  processTokenBalance,
  writeCSVOutput,
  prepareBlockNumbersArr,
  getAllPairData,
  Semaphore,
  isRelevantPair,
  getInitialBlock,
  getEndBlock,
} from './sdk/utils';
import {
  getUserClassicPositions,
  getUserConcentratedPositions,
  getUsersWithGaugeLiquidityPositions,
  getBlockTimestamp,
  getUserPreMiningPositions,
} from './sdk/subgraphDetails';

// Constants
const BATCH_SIZE = 40; // Process 40 blocks every 10 seconds
const RATE_LIMIT_WINDOW = 10000; // 10 seconds in ms

const initialBlockInput = process.argv[2] ? parseInt(process.argv[2]) : undefined; // Block where we start to pick up data
const endBlockInput = process.argv[3] ? parseInt(process.argv[3]) : undefined; // Block where we stop to pick up data

const processPositionData = async (block: number): Promise<PositionData | null> => {
  try {
    const timestamp = await getBlockTimestamp(block);

    const classicPositions = await getUserClassicPositions(block, CHAINS.ZIRCUIT);
    const concentratedPositions = await getUserConcentratedPositions(block, CHAINS.ZIRCUIT);
    const gaugePositions = await getUsersWithGaugeLiquidityPositions(block, CHAINS.ZIRCUIT);
    const preMiningPositions = await getUserPreMiningPositions(block, CHAINS.ZIRCUIT);

    if (
      gaugePositions.length === 0 &&
      classicPositions.length === 0 &&
      concentratedPositions.length === 0 &&
      preMiningPositions.length === 0
    ) {
      console.log(`No data found for block ${block}, skipping...`);
      return null;
    }

    const filteredClassicPositions = classicPositions.filter((pos) => isRelevantPair(pos.token0.address, pos.token1.address));
    const filteredConcentratedPositions = concentratedPositions.filter((pos) => isRelevantPair(pos.token0.address, pos.token1.address));
    const filteredGaugePositions = gaugePositions.map(user => ({
      ...user,
      liquidityPositions: user.liquidityPositions.filter((pos: GaugeLiquidityPosition) => 
        isRelevantPair(pos.gauge.token0.id, pos.gauge.token1.id)
      )
    })).filter(user => user.liquidityPositions.length > 0);
    const filteredPreMiningPositions = preMiningPositions.map(user => ({
      ...user,
      liquidityPositions: user.liquidityPositions.filter((pos: PreMiningPosition) => 
        isRelevantPair(pos.premining.token0.id, pos.premining.token1.id)
      )
    })).filter(user => user.liquidityPositions.length > 0);

    const pairs = [
      ...new Set([
        ...filteredClassicPositions.map((pos) => pos.pair),
        ...filteredConcentratedPositions.map((pos) => pos.pair),
        ...filteredGaugePositions.flatMap((user) =>
          user.liquidityPositions.map((pos: GaugeLiquidityPosition) => pos.gauge.pool),
        ),
        ...filteredPreMiningPositions.flatMap((user) =>
          user.liquidityPositions.map((pos: PreMiningPosition) => pos.premining.pool),
        ),
      ]),
    ];

    return {
      block,
      timestamp,
      pairs,
      gaugePositions: filteredGaugePositions,
      classicPositions: filteredClassicPositions,
      concentratedPositions: filteredConcentratedPositions,
      preMiningPositions: filteredPreMiningPositions,
    };
  } catch (error) {
    console.error(`Error processing block ${block}:`, error);
    return null;
  }
};

const processPositions = (positionData: PositionData, pairData: Record<string, LensResponse>): TokenBalance[] => {
  const balances: TokenBalance[] = [];

  // Process gauge positions
  for (const user of positionData.gaugePositions) {
    for (const pos of user.liquidityPositions) {
      const pairInfo = pairData[pos.gauge.pool];
      if (!pairInfo) continue;

      // Calculate user's share of the pool using total LP supply
      const userShare = (BigInt(pos.amount) * BigInt(1e18)) / pairInfo.total_supply;

      // Calculate token amounts based on reserves and user's share
      const token0Amount = (pairInfo.reserve0 * userShare) / BigInt(1e18);
      const token1Amount = (pairInfo.reserve1 * userShare) / BigInt(1e18);

      const token0Balance = processTokenBalance(token0Amount.toString(), user.id, pos.gauge.token0.id, pos.gauge.pool);
      const token1Balance = processTokenBalance(token1Amount.toString(), user.id, pos.gauge.token1.id, pos.gauge.pool);

      if (token0Balance) balances.push(token0Balance);
      if (token1Balance) balances.push(token1Balance);
    }
  }

  // Process premining positions
  for (const user of positionData.preMiningPositions) {
    for (const pos of user.liquidityPositions) {
      const pairInfo = pairData[pos.premining.pool];
      if (!pairInfo) continue;

      // Calculate user's share of the pool using total LP supply
      const userShare = (BigInt(pos.amount) * BigInt(1e18)) / pairInfo.total_supply;

      // Calculate token amounts based on reserves and user's share
      const token0Amount = (pairInfo.reserve0 * userShare) / BigInt(1e18);
      const token1Amount = (pairInfo.reserve1 * userShare) / BigInt(1e18);

      const token0Balance = processTokenBalance(token0Amount.toString(), user.id, pos.premining.token0.id, pos.premining.pool);
      const token1Balance = processTokenBalance(token1Amount.toString(), user.id, pos.premining.token1.id, pos.premining.pool);

      if (token0Balance) balances.push(token0Balance);
      if (token1Balance) balances.push(token1Balance);
    }
  }

  // Process classic positions
  for (const pos of positionData.classicPositions) {
    const userId = pos.id.split('-')[0];
    const token0Balance = processTokenBalance(pos.token0.balance, userId, pos.token0.address, pos.pair);
    const token1Balance = processTokenBalance(pos.token1.balance, userId, pos.token1.address, pos.pair);

    if (token0Balance) balances.push(token0Balance);
    if (token1Balance) balances.push(token1Balance);
  }

  // Process concentrated positions
  for (const pos of positionData.concentratedPositions) {
    const token0Balance = processTokenBalance(pos.token0.balance, pos.id, pos.token0.address, pos.pair);
    const token1Balance = processTokenBalance(pos.token1.balance, pos.id, pos.token1.address, pos.pair);

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

      const pairData = await getAllPairData(positionData.pairs, client, block);
      const balances = processPositions(positionData, pairData);
      
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

    const initialBlock = getInitialBlock(initialBlockInput);
    const endBlock = await getEndBlock(client as PublicClient, endBlockInput);

    const snapshotBlocks = prepareBlockNumbersArr(initialBlock, INTERVAL, endBlock);

    console.log(`Analyzing interval: ${initialBlock} - ${endBlock}`);
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
