import * as fs from 'fs';
import { write } from 'fast-csv';
import * as path from "path";
import { CHAINS, PROTOCOLS } from "./sdk/config";
import { getUserReservesWithHistory, UserReserveData } from "./sdk/subgraphDetails";
import { getBlockByTimestamp } from './utils/helper';

interface CSVRow {
  user: string;
  token_address: string;
  block: number;
  token_balance: string;
  timestamp: number;
}

const mapUserReservesToCSVRows = async (
  userReserves: UserReserveData[]
): Promise<CSVRow[]> => {
  const csvRows: CSVRow[] = [];

  for (const reserve of userReserves) {
    for (const history of reserve.aTokenBalanceHistory) {
      const timestamp = parseInt(history.timestamp);
      const blockNumber = await getBlockByTimestamp(timestamp);
      
      csvRows.push({
        user: reserve.user.id,
        token_address: reserve.reserve.underlyingAsset,
        block: blockNumber,
        token_balance: history.currentATokenBalance,
        timestamp
      });
    }
  }

  return csvRows;
};

const OUTPUT_DIR = path.resolve(__dirname, "../out");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "tvl-snapshot-zerolend.csv");
const getData = async () => {
  const csvRows: CSVRow[] = [];

  try {
    const userReserves = await getUserReservesWithHistory(
      CHAINS.ZIRCUIT,
      PROTOCOLS.ZEROLEND
    );

    if (userReserves.length > 0) {
      const rows = await mapUserReservesToCSVRows(userReserves);
      csvRows.push(...rows);
      console.log(`Generated ${rows.length} CSV records`);
    }
  } catch (error) {
    console.error(`Error processing in fetching data:`, error);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const ws = fs.createWriteStream(OUTPUT_PATH);

  write(csvRows, { headers: true })
    .pipe(ws)
    .on('finish', () => {
      console.log("CSV file has been written to:", OUTPUT_PATH

      );
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