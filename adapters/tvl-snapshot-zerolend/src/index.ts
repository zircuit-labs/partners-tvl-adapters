import * as fs from 'fs';
import { write } from 'fast-csv';
import * as path from "path";
import { CHAINS, PROTOCOLS } from "./sdk/config";
import { getUserReservesForBlock, UserReserveData } from "./sdk/subgraphDetails";
import { getBlockByTimestamp } from './utils/helper';

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

const mapUserReservesToCSVRows = async (
  userReserves: UserReserveData[],
  blockNumber: number
): Promise<CSVRow[]> => {
  const csvRows: CSVRow[] = [];

  for (const reserve of userReserves) {

    const timestamp = parseInt(reserve.lastUpdateTimestamp);
    const blockNumber = await getBlockByTimestamp(timestamp);
    
    csvRows.push({
      user: reserve.user.id,
      token_address: reserve.reserve.underlyingAsset,
      block: blockNumber,
      token_balance: reserve.currentATokenBalance,
      timestamp
    });
  }

  return csvRows;
};

const INITIAL_BLOCK = 2662044;
const OUTPUT_FILE = "../out/tvl-snapshot-zerolend.csv";

const getData = async () => {
  const csvRows: CSVRow[] = [];

  try {
    const userReserves = await getUserReservesForBlock(
      CHAINS.ZIRCUIT,
      PROTOCOLS.ZEROLEND,
      INITIAL_BLOCK
    );

    if (userReserves.length > 0) {
      const blockRows = await mapUserReservesToCSVRows(userReserves, INITIAL_BLOCK);
      csvRows.push(...blockRows);
      // console.log(`Added ${blockRows.length} records for block ${INITIAL_BLOCK}`);
    } else {
      console.log(`No data found for block ${INITIAL_BLOCK}`);
    }
  } catch (error) {
    console.error(`Error processing block ${INITIAL_BLOCK}:`, error);
  }

  const outputDir = path.resolve(__dirname, "../out");
  fs.mkdirSync(outputDir, { recursive: true });


  const outputPath = path.resolve(__dirname, OUTPUT_FILE);
  const ws = fs.createWriteStream(outputPath);

  write(csvRows, { headers: true })
    .pipe(ws)
    .on('finish', () => {
      console.log("CSV file has been written to:", outputPath);
      console.log(`Total records: ${csvRows.length}`);
    });
};

getData()
  .then(() => {
    console.log("Done");
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });