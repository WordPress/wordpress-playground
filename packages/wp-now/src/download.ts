import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import unzipper from 'unzipper';
import os from 'os';
import { IncomingMessage } from 'http';
import {
	DEFAULT_WORDPRESS_VERSION,
	SQLITE_PATH,
	SQLITE_URL,
	WORDPRESS_VERSIONS_PATH,
	WP_NOW_PATH,
} from './constants';

function getWordPressVersionUrl(version = DEFAULT_WORDPRESS_VERSION) {
  return `https://wordpress.org/wordpress-${version}.zip`;
}

async function downloadFileAndUnzip({
	url,
	destinationFolder,
	checkFinalPath,
	itemName,
}): Promise<boolean> {
	if (fs.existsSync(checkFinalPath)) {
		console.log(`${itemName} folder already exists. Skipping download.`);
		return;
	}

	try {
		fs.ensureDirSync(path.dirname(destinationFolder));

		console.log(`Downloading ${itemName}...`);
		const response = await new Promise<IncomingMessage>((resolve) =>
			https.get(url, { timeout: 0 }, (response) => resolve(response))
		);

		if (response.statusCode !== 200) {
			throw new Error(
				`Failed to download file (Status code ${response.statusCode}).`
			);
		}

		/**
		 * Using Parse because Extract is broken:
		 * https://github.com/WordPress/wordpress-playground/issues/248
		 */
		await response
			.pipe(unzipper.Parse())
			.on('entry', (entry) => {
				const filePath = path.join(destinationFolder, entry.path);
				/*
				 * Use the sync version to ensure entry is piped to
				 * a write stream before moving on to the next entry.
				 */
				fs.ensureDirSync(path.dirname(filePath));

				if (entry.type !== 'Directory') {
					entry.pipe(fs.createWriteStream(filePath));
				}
			})
      .promise();
    return true
	} catch (err) {
		console.error(`Error downloading or unzipping ${itemName}:`, err);
  }
  return false
}

export async function downloadWordPress(wordPressVersion = DEFAULT_WORDPRESS_VERSION) {
  const finalFolder = path.join(WORDPRESS_VERSIONS_PATH, wordPressVersion);
  const temporalFolder = os.tmpdir();
	const downloaded = await downloadFileAndUnzip({
		url: getWordPressVersionUrl(wordPressVersion),
		destinationFolder: temporalFolder,
		checkFinalPath: finalFolder,
		itemName: `WordPress ${wordPressVersion}`,
  });
  console.log('downloaded', downloaded)
  if (downloaded) {
    fs.ensureDirSync(path.dirname(finalFolder));
    fs.renameSync(path.join(temporalFolder, 'wordpress'), finalFolder);
  }
}

export async function downloadSqliteIntegrationPlugin() {
	return downloadFileAndUnzip({
		url: SQLITE_URL,
		destinationFolder: WP_NOW_PATH,
		checkFinalPath: SQLITE_PATH,
		itemName: 'Sqlite',
	});
}
