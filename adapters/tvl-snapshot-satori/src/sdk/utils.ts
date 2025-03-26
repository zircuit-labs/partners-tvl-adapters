import fs from 'fs';
import path from 'path';
import { write } from 'fast-csv';
import { CSVRow } from './config';

export const writeCSVOutput = async (rows: CSVRow[], outputFile: string): Promise<void> => {
  const outputDir = path.resolve(__dirname, '../../out');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, path.basename(outputFile));
  const ws = fs.createWriteStream(outputPath);

  return new Promise((resolve, reject) => {
    write(rows, { headers: true })
      .pipe(ws)
      .on('finish', () => {
        console.log(`CSV file has been written to: ${outputPath}`);
        console.log(`Total rows: ${rows.length}`);
        resolve();
      })
      .on('error', reject);
  });
};
