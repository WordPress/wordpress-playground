import request from 'request';
import fs from 'fs-extra';
import unzipper from 'unzipper';
import path from 'path';
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
	if (!fs.existsSync(checkFinalPath)) {
		try {
			fs.ensureDirSync(path.dirname(destinationFolder));
			console.log(`Downloading ${itemName}...`);
			await request(url)
				.pipe(unzipper.Extract({ path: destinationFolder }))
				.promise();
		} catch (err) {
			console.error(`Error downloading or unzipping ${itemName}:`, err);
		}
	} else {
		console.log(`${itemName} folder already exists. Skipping download.`);
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

export async function downloadSqlite() {
	return downloadFileAndUnzip({
		url: SQLITE_URL,
		destinationFolder: WP_NOW_PATH,
		checkFinalPath: SQLITE_PATH,
		itemName: 'Sqlite',
	});
}
