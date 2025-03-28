import { CHAINS, PROTOCOLS, CSVRow } from "./sdk/config";
import { getUserReservesWithHistory, UserReserveData } from "./sdk/subgraphDetails";
import { writeCSVOutput } from "./sdk/utils";

// Constants
const OUTPUT_FILE = '../out/tvl-snapshot-zerolend.csv'

const mapUserReservesToCSVRows = async (
  userReserves: UserReserveData[]
): Promise<CSVRow[]> => {
  const csvRows: CSVRow[] = [];

  for (const reserve of userReserves) {
    for (const history of reserve.aTokenBalanceHistory) {
      const timestamp = parseInt(history.timestamp);
      
      csvRows.push({
        user: reserve.user.id,
        token_address: reserve.reserve.underlyingAsset,
        block: 0,
        token_balance: history.currentATokenBalance,
        timestamp
      });
    }
  }

  return csvRows;
};

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

    await writeCSVOutput(csvRows, OUTPUT_FILE);
  } catch (error) {
    console.error(`Error processing in fetching data:`, error);
  }
};

getData()
  .then(() => {
    console.log("Done");
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
