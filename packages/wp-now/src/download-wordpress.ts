import request from 'request';
import fs from 'fs-extra';
import path from 'path';
import { WP_DOWNLOAD_URL, WP_NOW_DIRECTORY } from './constants';

const WORDPRESS_ZIPS_FOLDER = path.join(WP_NOW_DIRECTORY, 'wordpress');

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

export async function downloadWordPress(fileName = 'latest.zip') {
  // Check if the WordPress folder exists, if not, download and unzip
  const zipPath = path.join(WORDPRESS_ZIPS_FOLDER, fileName)
  if (!fs.existsSync(zipPath)) {
    try {
      fs.ensureDirSync(WORDPRESS_ZIPS_FOLDER);
      console.log('Downloading WordPress...');
      await downloadFile(WP_DOWNLOAD_URL, zipPath);
      console.log('Download complete.');
    } catch (err) {
      console.error('Error:', err);
    }
  } else {
    console.log('WordPress folder already exists. Skipping download.');
  }
}
