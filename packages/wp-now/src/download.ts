import fs from 'fs-extra';
import path from 'path';
import followRedirects from 'follow-redirects';
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
import { isValidWordpressVersion } from './wp-playground-wordpress';

function getWordPressVersionUrl(version = DEFAULT_WORDPRESS_VERSION) {
	if (!isValidWordpressVersion(version)) {
		throw new Error(
			'Unrecognized WordPress version. Please use "latest" or numeric versions such as "6.2", "6.0.1", "6.2-beta1", or "6.2-RC1"'
		);
	}
	return `https://wordpress.org/wordpress-${version}.zip`;
}

interface DownloadFileAndUnzipResult {
	downloaded: boolean;
	statusCode: number;
}

followRedirects.maxRedirects = 5;
const { https } = followRedirects;

async function downloadFileAndUnzip({
	url,
	destinationFolder,
	checkFinalPath,
	itemName,
}): Promise<DownloadFileAndUnzipResult> {
	if (fs.existsSync(checkFinalPath)) {
		console.log(`${itemName} folder already exists. Skipping download.`);
		return;
	}

	let statusCode = 0;

	try {
		fs.ensureDirSync(path.dirname(destinationFolder));

		console.log(`Downloading ${itemName}...`);
		const response = await new Promise<IncomingMessage>((resolve) =>
			https.get(url, (response) => resolve(response))
		);
		statusCode = response.statusCode;

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
		return { downloaded: true, statusCode };
	} catch (err) {
		console.error(`Error downloading or unzipping ${itemName}:`, err);
	}
	return { downloaded: false, statusCode };
}

export async function downloadWordPress(
	wordPressVersion = DEFAULT_WORDPRESS_VERSION
) {
	const finalFolder = path.join(WORDPRESS_VERSIONS_PATH, wordPressVersion);
	const tempFolder = os.tmpdir();
	const { downloaded, statusCode } = await downloadFileAndUnzip({
		url: getWordPressVersionUrl(wordPressVersion),
		destinationFolder: tempFolder,
		checkFinalPath: finalFolder,
		itemName: `WordPress ${wordPressVersion}`,
	});
	console.log('downloaded', downloaded);
	if (downloaded) {
		fs.ensureDirSync(path.dirname(finalFolder));
		fs.renameSync(path.join(tempFolder, 'wordpress'), finalFolder);
	} else if (404 === statusCode) {
		console.log(
			`WordPress ${wordPressVersion} not found. Check https://wordpress.org/download/releases/ for available versions.`
		);
		process.exit(1);
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
