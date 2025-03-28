import axios from 'axios';
import { CSVRow } from './sdk/config';
import { writeCSVOutput, withRetry } from './sdk/utils';
import { parseUnits } from 'viem';

// API Constants
const BASE_URL = 'https://trade.satori.finance/api/data-center/pub/activities/tvlActive';
const DELAY_MS = 250; // Delay between API calls to avoid rate limiting

// Token Addresses and Settings
const TOKENS = {
  WETH: {
    symbol: 'WETH',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
  },
  USDC: {
    symbol: 'USDC',
    address: '0x3b952c8C9C44e8Fe201e2b26F6B2200203214cfF',
    decimals: 6,
  },
};

// Constants
const OUTPUT_FILE = '../out/tvl-snapshot-satori.csv';

// Function to add delay between requests
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to fetch data from the API for a specific token
async function fetchData(symbol: string, timestamp: string | null = null) {
  try {
    // Construct URL with parameters
    let url = `${BASE_URL}?chain=zircuit&symbol=${symbol}&limit=100`;
    if (timestamp) {
      url += `&timestamp=${timestamp}`;
    }

    console.log(`Fetching ${symbol} data from: ${url}`);

    const response = await withRetry(() => axios.get(url));
    const data = response.data;

    // Check if the request was successful
    if (data.error || data.code !== 200) {
      throw new Error(`API error: ${data.msg}`);
    }

    // Check if we got any data
    if (!data.data || data.data.length === 0) {
      console.log(`No more ${symbol} data available.`);
      return { records: [], oldestTimestamp: null };
    }

    console.log(`Fetched ${data.data.length} ${symbol} records.`);

    // Find the oldest timestamp in the current batch
    const oldestTimestamp = data.data.reduce((oldest: string, item: any) => {
      return parseInt(item.timestamp) < parseInt(oldest) ? item.timestamp : oldest;
    }, data.data[0].timestamp);

    return {
      records: data.data,
      oldestTimestamp: oldestTimestamp,
    };
  } catch (error: any) {
    console.error(`Error fetching ${symbol} data:`, error.message);
    return { records: [], oldestTimestamp: null };
  }
}

// Checks if two arrays of records are identical
function areRecordsIdentical(recordsA: any[], recordsB: any[]) {
  if (recordsA.length !== recordsB.length) return false;

  // Simple check - just compare the stringified versions
  const strA = JSON.stringify(recordsA);
  const strB = JSON.stringify(recordsB);

  return strA === strB;
}

// Function to fetch all TVL activity data from API for a specific token
async function fetchAllTokenData(symbol: string) {
  const allData: any[] = [];
  let timestamp = null;
  let page = 1;
  let previousRecords: any[] = [];

  console.log(`Starting to fetch ${symbol} TVL activity data from API...`);

  while (true) {
    console.log(`Fetching ${symbol} page ${page}...`);
    const { records, oldestTimestamp } = await fetchData(symbol, timestamp);

    // If no data returned, break the loop
    if (records.length === 0 || !oldestTimestamp) {
      console.log(`No more ${symbol} data to fetch.`);
      break;
    }

    // Check if we're getting the exact same records as the previous request
    if (areRecordsIdentical(records, previousRecords)) {
      console.log(`Received the same ${symbol} data as previous request. Stopping.`);
      break;
    }

    // Add the new records to our collection
    allData.push(...records);

    // Store current records for next comparison
    previousRecords = records;

    // Use the oldest timestamp for the next request
    timestamp = oldestTimestamp;

    // Wait before the next request
    await delay(DELAY_MS);

    page++;
  }

  console.log(`Fetched a total of ${allData.length} ${symbol} TVL activity records from API`);
  return allData;
}

function toWei(amount: number, decimals: number): bigint {
  return parseUnits(amount.toString(), decimals);
}

// Process API data to create a row for each balance change
function processAPIDataToTimeseriesFormat(apiData: any[], tokenSymbol: string): CSVRow[] {
  console.log(`Processing ${tokenSymbol} API data to time series format...`);

  // Sort data by timestamp (oldest first)
  const sortedData = [...apiData].sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));

  // Track each user's balance over time
  const userBalanceHistory: Record<string, CSVRow[]> = {};
  const token = TOKENS[tokenSymbol as keyof typeof TOKENS];

  // Process each record chronologically
  for (const item of sortedData) {
    const address = item.address;
    const amount = parseFloat(item.amount);
    const activeType = item.activeType;
    const timestamp = Math.floor(parseInt(item.timestamp) / 1000);

    // Initialize user balance history if not exists
    if (!userBalanceHistory[address]) {
      userBalanceHistory[address] = [];
    }

    // Get current balance (0 if no previous history)
    const currentBalance =
      userBalanceHistory[address].length > 0
        ? BigInt(userBalanceHistory[address][userBalanceHistory[address].length - 1].token_balance)
        : BigInt(0);

    // Convert amount to wei
    const amountInWei = toWei(amount, token.decimals);

    // Calculate new balance based on activity type
    let newBalance = currentBalance;
    switch (activeType) {
      case 'Contract deposit':
      case 'Increase in balance':
        newBalance = currentBalance + amountInWei;
        break;
      case 'Withdraw successfully':
      case 'Decrease in balance':
        newBalance = currentBalance - amountInWei;
        break;
      default:
        console.warn(`Unknown activity type: ${activeType} for address ${address}`);
        continue; // Skip this record
    }

    // Only record if balance actually changed
    if (newBalance !== currentBalance) {
      userBalanceHistory[address].push({
        user: address,
        token_address: token.address,
        block: 0, // not needed
        token_balance: newBalance.toString(),
        timestamp: timestamp,
      });
    }
  }

  // Flatten the history into a single array
  const allBalanceChanges: CSVRow[] = [];
  for (const userHistory of Object.values(userBalanceHistory)) {
    allBalanceChanges.push(...userHistory);
  }

  // Sort all changes by timestamp
  allBalanceChanges.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`Generated ${allBalanceChanges.length} balance change records for ${tokenSymbol}`);
  return allBalanceChanges;
}

// Main data processing function
const getData = async () => {
  console.log('Starting TVL snapshot generation...');

  try {
    const allBalanceChanges: CSVRow[] = [];

    // Process each token type
    for (const tokenKey of Object.keys(TOKENS)) {
      const tokenSymbol = TOKENS[tokenKey as keyof typeof TOKENS].symbol;

      // Step 1: Fetch API data for this token
      console.log(`Fetching TVL activity data for ${tokenSymbol} from Satori API...`);
      const apiData = await fetchAllTokenData(tokenSymbol);
      console.log(`Successfully fetched ${apiData.length} ${tokenSymbol} TVL activity records`);

      // Step 2: Process API data to generate time series of balance changes
      const tokenBalanceChanges = processAPIDataToTimeseriesFormat(apiData, tokenSymbol);
      allBalanceChanges.push(...tokenBalanceChanges);
    }

    // Step 3: Sort all balance changes by timestamp
    allBalanceChanges.sort((a, b) => a.timestamp - b.timestamp);

    // Step 4: Write all balance changes to CSV
    console.log(`Writing ${allBalanceChanges.length} balance changes to CSV...`);
    await writeCSVOutput(allBalanceChanges, OUTPUT_FILE);
    console.log(`TVL snapshot with balance changes saved to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
};

getData()
  .then(() => console.log('Done'))
  .catch(console.error);
