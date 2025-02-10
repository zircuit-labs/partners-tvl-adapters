import { CHAINS, PROTOCOLS } from "./sdk/config";
import { getExchangeRatesBeforeBlock, getBalanceChangesBeforeBlock, getLPValueByUser } from "./sdk/subgraphDetails";
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from 'fs';
import { write } from 'fast-csv';
import path from "path";
import { createPublicClient, http } from "viem";
import { zircuit } from "viem/chains";

interface CSVRow {
  user: string;
  token_address: string;
  block: number;
  token_balance: string;
  timestamp: number;
}

const prepareBlockNumbersArr = (
  startBlockNumber: number,
  interval: number,
  endBlockNumber: number
) => {
  const blockNumbers = [];
  let currentBlockNumber = startBlockNumber;
  do {
    blockNumbers.push(currentBlockNumber);
    currentBlockNumber += interval;
  } while (currentBlockNumber <= endBlockNumber);

  return blockNumbers;
};

const getEndBlock = async () => {
  const client = createPublicClient({
    chain: zircuit,
    transport: http()
  })
  const endBlock = Number(await client.getBlockNumber())
  return endBlock
}

const INITIAL_BLOCK = 6026314; // Creation block of oldest Elara pool
const INTERVAL = 1800; // Hourly interval, Zircuit block time is 2 seconds

const OUTPUT_FILE = "../out/tvl_snapshot_elara.csv";

const getData = async () => {
  const csvRows: CSVRow[] = [];

  const END_BLOCK = await getEndBlock()
  console.log(`Fetching data from subgraph... end block: ${END_BLOCK}`)
  
  const [exchangeRates, balanceChanges] = await Promise.all([
    getExchangeRatesBeforeBlock(END_BLOCK, CHAINS.ZIRCUIT, PROTOCOLS.ELARA),
    getBalanceChangesBeforeBlock(END_BLOCK, CHAINS.ZIRCUIT, PROTOCOLS.ELARA)
  ])

  // We are limited by the subgraph, so the end block is the largest block of exchange rates
  const endBlock = exchangeRates[exchangeRates.length - 1].blockNumber
  const snapshotBlocks = prepareBlockNumbersArr(INITIAL_BLOCK, INTERVAL, Number(endBlock))

  for (let [index, block] of snapshotBlocks.entries()) {
    console.log(`Processing block ${block}: ${index + 1} of ${snapshotBlocks.length}`);

    const lpValueByUsers = getLPValueByUser(
      exchangeRates.filter(rate => rate.blockNumber <= block),
      balanceChanges.filter(change => change.blockNumber <= block))

    lpValueByUsers.forEach((value, key) => {
      value.forEach((lpValue, lpToken) => {
        const lpValueStr = lpValue;
        // Accumulate CSV row data
        csvRows.push({
          user: key,
          token_address: lpToken,
          block,
          token_balance: lpValueStr.value.toFixed(0),
          timestamp: lpValueStr.timestamp,
        });
      });
    });
  }

  // Create output directory if it doesn't exist
  const outputDir = path.resolve(__dirname, "../out");
  fs.mkdirSync(outputDir, { recursive: true });

  // Write the CSV output to a file
  const outputPath = path.resolve(__dirname, OUTPUT_FILE);
  const ws = fs.createWriteStream(outputPath);
  write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
    console.log("CSV file has been written to:", outputPath);
  });
};

getData().then(() => {
  console.log("Done");
});
