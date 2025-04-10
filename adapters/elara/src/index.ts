import { CHAINS, PROTOCOLS, INTERVAL, OUTPUT_FILE } from "./sdk/config";
import { getExchangeRatesBeforeBlock, getBalanceChangesBeforeBlock, getLPValueByUser, getBlockTimestamps } from "./sdk/subgraphDetails";
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from 'fs';
import { write } from 'fast-csv';
import path from "path";
import { createPublicClient, http, PublicClient } from "viem";
import { zircuit } from "viem/chains";
import { getEndBlock, getInitialBlock } from "./sdk/utils";

interface CSVRow {
  user: string;
  token_address: string;
  block: number;
  token_balance: string;
  timestamp: number;
}

const initialBlockInput = process.argv[2] ? parseInt(process.argv[2]) : undefined; // Block where we start to pick up data
const endBlockInput = process.argv[3] ? parseInt(process.argv[3]) : undefined; // Block where we stop to pick up data

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

const getData = async () => {
  const csvRows: CSVRow[] = [];

  const client = createPublicClient({ chain: zircuit, transport: http() })

  const initialBlock = getInitialBlock(initialBlockInput)
  let endBlock = await getEndBlock(client as PublicClient, undefined)

  console.log(`Analyzing data from block ${initialBlock} to ${endBlock}`)
  
  const [exchangeRates, balanceChanges] = await Promise.all([
    getExchangeRatesBeforeBlock(endBlock, CHAINS.ZIRCUIT, PROTOCOLS.ELARA),
    getBalanceChangesBeforeBlock(endBlock, CHAINS.ZIRCUIT, PROTOCOLS.ELARA)
  ])

  // We are limited by the subgraph, so the end block is the largest block of exchange rates
  endBlock = Math.min(
    await getEndBlock(client as PublicClient, endBlockInput),
    await getEndBlock(client as PublicClient, Number(exchangeRates[exchangeRates.length - 1].blockNumber))
  )
  const snapshotBlocks = prepareBlockNumbersArr(initialBlock, INTERVAL, endBlock)

  const timestamps = await getBlockTimestamps(snapshotBlocks)

  for (let [index, block] of snapshotBlocks.entries()) {
    console.log(`Processing block ${block}: ${index + 1} of ${snapshotBlocks.length}`);

    const timestamp = timestamps[block]

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
          timestamp,
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
    console.log("Exported from block", initialBlock, "to", endBlock);
  });
};

getData().then(() => {
  console.log("Done");
});
