import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import unzipper from 'unzipper';
import { IncomingMessage } from 'http';
import {
	SQLITE_PATH,
	SQLITE_URL,
	WORDPRESS_VERSIONS_PATH,
	WP_DOWNLOAD_URL,
	WP_NOW_PATH,
} from './constants';

async function downloadFileAndUnzip({
	url,
	destinationFolder,
	checkFinalPath,
	itemName,
}) {
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
	} catch (err) {
		console.error(`Error downloading or unzipping ${itemName}:`, err);
	}
}

export async function downloadWordPress(fileName = 'latest') {
	await downloadFileAndUnzip({
		url: WP_DOWNLOAD_URL,
		destinationFolder: path.join(WORDPRESS_VERSIONS_PATH, fileName),
		checkFinalPath: path.join(WORDPRESS_VERSIONS_PATH, fileName),
		itemName: `WordPress ${fileName}`,
	});
}

export async function downloadSqliteIntegrationPlugin() {
	return downloadFileAndUnzip({
		url: SQLITE_URL,
		destinationFolder: WP_NOW_PATH,
		checkFinalPath: SQLITE_PATH,
		itemName: 'Sqlite',
	});
}
