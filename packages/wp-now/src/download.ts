import request from 'request';
import fs from 'fs-extra';
import unzipper from 'unzipper';
import path from 'path';
import {
	SQLITE_FILENAME,
	SQLITE_PATH,
	SQLITE_URL,
	WORDPRESS_VERSIONS_PATH,
	WP_DOWNLOAD_URL,
	WP_NOW_PATH,
} from './constants';

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

async function downloadFileAndUnzip({
	url,
	zipPath,
	unzipPath,
	checkFinalPath,
	itemName,
}) {
	if (!fs.existsSync(checkFinalPath)) {
		try {
			fs.ensureDirSync(path.dirname(zipPath));
			console.log(`Downloading ${itemName}...`);
			await downloadFile(url, zipPath);
			// unzip the file
			console.log(`Unzipping ${itemName}...`);
			await fs
				.createReadStream(zipPath)
				.pipe(unzipper.Extract({ path: unzipPath }))
				.promise();
			console.log('Removing Zip.');
			await fs.remove(zipPath);
		} catch (err) {
			console.error(`Error downloading or unzipping ${itemName}:`, err);
		}
	} else {
		console.log(`${itemName} folder already exists. Skipping download.`);
	}
}

export async function downloadWordPress(fileName = 'latest') {
	return downloadFileAndUnzip({
		url: WP_DOWNLOAD_URL,
		zipPath: path.join(WORDPRESS_VERSIONS_PATH, `${fileName}.zip`),
		unzipPath: path.join(WORDPRESS_VERSIONS_PATH, fileName),
		checkFinalPath: path.join(WORDPRESS_VERSIONS_PATH, fileName),
		itemName: `WordPress ${fileName}`,
	});
}

export async function downloadSqlite() {
	return downloadFileAndUnzip({
		url: SQLITE_URL,
		zipPath: path.join(WP_NOW_PATH, `${SQLITE_FILENAME}.zip`),
		unzipPath: WP_NOW_PATH,
		checkFinalPath: SQLITE_PATH,
		itemName: 'Sqlite',
	});
}
