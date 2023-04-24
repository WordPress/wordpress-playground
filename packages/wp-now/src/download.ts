import request from 'request';
import fs from 'fs-extra';
import unzipper from 'unzipper';

import path from 'path';
import { WORDPRESS_VERSIONS_PATH, WORDPRESS_ZIPS_PATH, WP_DOWNLOAD_URL } from './constants';

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

export async function downloadWordPress(fileName = 'latest') {
  // Check if the WordPress folder exists, if not, download and unzip
  const zipPath = path.join(WORDPRESS_ZIPS_PATH, `${fileName}.zip`)
  const unzipPath = path.join(WORDPRESS_VERSIONS_PATH, fileName)
  if (!fs.existsSync(unzipPath)) {
    try {
      fs.ensureDirSync(WORDPRESS_ZIPS_PATH);
      console.log('Downloading WordPress...');
      await downloadFile(WP_DOWNLOAD_URL, zipPath);
      console.log('Download complete.');
      // unzip the file
      console.log('Unzipping WordPress...');
      await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: unzipPath })).promise();
      console.log('Unzipping complete.');

    } catch (err) {
      console.error('Error:', err);
    }
  } else {
    console.log('WordPress folder already exists. Skipping download.');
  }
}
