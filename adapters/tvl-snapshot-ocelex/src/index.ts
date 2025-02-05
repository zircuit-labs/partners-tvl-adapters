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
} from './sdk/config';
import {
  processTokenBalance,
  aggregateBalances,
  writeCSVOutput,
  prepareBlockNumbersArr,
  getAllPairData,
} from './sdk/utils';
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

    const pairs = [
      ...new Set([
        ...classicPositions.map((pos) => pos.pair),
        ...concentratedPositions.map((pos) => pos.pair),
        ...gaugePositions.flatMap((user) =>
          user.liquidityPositions.map((pos: GaugeLiquidityPosition) => pos.gauge.pool),
        ),
        ...preMiningPositions.flatMap((user) =>
          user.liquidityPositions.map((pos: PreMiningPosition) => pos.premining.pool),
        ),
      ]),
    ];

    return {
      block,
      timestamp,
      pairs,
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

      const token0Balance = processTokenBalance(token0Amount.toString(), user.id, pos.gauge.token0.id);
      const token1Balance = processTokenBalance(token1Amount.toString(), user.id, pos.gauge.token1.id);

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

      const token0Balance = processTokenBalance(token0Amount.toString(), user.id, pos.premining.token0.id);
      const token1Balance = processTokenBalance(token1Amount.toString(), user.id, pos.premining.token1.id);

      if (token0Balance) balances.push(token0Balance);
      if (token1Balance) balances.push(token1Balance);
    }
  }

  // Process classic positions
  for (const pos of positionData.classicPositions) {
    const userId = pos.id.split('-')[0];
    const token0Balance = processTokenBalance(pos.token0.balance, userId, pos.token0.address);
    const token1Balance = processTokenBalance(pos.token1.balance, userId, pos.token1.address);

    if (token0Balance) balances.push(token0Balance);
    if (token1Balance) balances.push(token1Balance);
  }

  // Process concentrated positions
  for (const pos of positionData.concentratedPositions) {
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

      const positionData = await processPositionData(block);
      if (!positionData) continue;

      const pairData = await getAllPairData(positionData.pairs, client as PublicClient, block);

      const balances = processPositions(positionData, pairData);
      const blockRows: CSVRow[] = balances.map((balance) => ({
        ...balance,
        block: positionData.block,
        timestamp: positionData.timestamp,
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
