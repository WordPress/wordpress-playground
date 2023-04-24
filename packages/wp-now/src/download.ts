import request from 'request';
import fs from 'fs-extra';
import unzipper from 'unzipper';

import path from 'path';
import { SQLITE_FILENAME, SQLITE_URL, SQLITE_ZIP_PATH, WORDPRESS_ZIPS_PATH, WP_DOWNLOAD_URL } from './constants';

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    request(url)
      .pipe(file)
      .on('finish', () => {
        file.close(() => resolve());
      })
      .on('error', (err: Error) => {
        fs.unlink(dest);
        reject(err);
      });
  });
}

async function downloadFileAndUnzip(url, zipPath, unzipPath, itemName) {
  if (!fs.existsSync(unzipPath)) {
    try {
      fs.ensureDirSync(path.dirname(zipPath));
      console.log(`Downloading ${itemName}...`);
      await downloadFile(url, zipPath);
      console.log('Download complete.');
      // unzip the file
      console.log(`Unzipping ${itemName}...`);
      await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: unzipPath })).promise();
      console.log('Unzipping complete.');
    } catch (err) {
      console.error(`Error downloading or unzipping ${itemName}:`, err);
    }
  } else {
    console.log(`${itemName} folder already exists. Skipping download.`);
  }
}

export async function downloadWordPress(fileName = 'latest') {
  return downloadFileAndUnzip(
    WP_DOWNLOAD_URL,
    path.join(WORDPRESS_ZIPS_PATH, `${fileName}.zip`),
    path.join(WORDPRESS_ZIPS_PATH, fileName),
    `WordPress ${fileName}`);
}

export async function downloadSqlite() {
  return downloadFileAndUnzip(
    SQLITE_URL,
    path.join(SQLITE_ZIP_PATH, `${SQLITE_FILENAME}.zip`),
    SQLITE_ZIP_PATH,
    'Sqlite');
}
