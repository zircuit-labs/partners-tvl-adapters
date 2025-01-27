import { CHAINS, PROTOCOLS } from "./sdk/config";
import { getExchangeRatesBeforeBlock, getBalanceChangesBeforeBlock, getLPValueByUser } from "./sdk/subgraphDetails";
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from 'fs';
import { write } from 'fast-csv';
import path from "path";

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

const INITIAL_BLOCK = 8090914;
const END_BLOCK = 10000000; // END_BLOCK set in the future to get all the data
const INTERVAL = 1800; // Hourly interval, Zircuit block time is 2 seconds

const OUTPUT_FILE = "../out/elara_tvl_snapshot.csv";

const getData = async () => {
  const csvRows: CSVRow[] = [];
  console.log("Fetching data from subgraph...")
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