import fs from 'fs-extra';
import path from 'path';
import followRedirects from 'follow-redirects';
import unzipper from 'unzipper';
import os from 'os';
import { IncomingMessage } from 'http';
import { DEFAULT_WORDPRESS_VERSION, SQLITE_URL, WP_CLI_URL } from './constants';
import { isValidWordPressVersion } from './wp-playground-wordpress';
import { output } from './output';
import getWpNowPath from './get-wp-now-path';
import getWordpressVersionsPath from './get-wordpress-versions-path';
import getSqlitePath from './get-sqlite-path';
import getWpCliPath from './get-wp-cli-path';

function getWordPressVersionUrl(version = DEFAULT_WORDPRESS_VERSION) {
	if (!isValidWordPressVersion(version)) {
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

async function downloadFile({
	url,
	destinationFilePath,
	itemName,
}): Promise<DownloadFileAndUnzipResult> {
	let statusCode = 0;
	try {
		if (fs.existsSync(destinationFilePath)) {
			return { downloaded: false, statusCode: 0 };
		}
		fs.ensureDirSync(path.dirname(destinationFilePath));
		const response = await new Promise<IncomingMessage>((resolve) =>
			https.get(url, (response) => resolve(response))
		);
		statusCode = response.statusCode;
		if (response.statusCode !== 200) {
			throw new Error(
				`Failed to download file (Status code ${response.statusCode}).`
			);
		}
		await new Promise<void>((resolve, reject) => {
			fs.ensureFileSync(destinationFilePath);
			const file = fs.createWriteStream(destinationFilePath);
			response.pipe(file);
			file.on('finish', () => {
				file.close();
				resolve();
			});
			file.on('error', (error) => {
				file.close();
				reject(error);
			});
		});
		output?.log(`Downloaded ${itemName} to ${destinationFilePath}`);
		return { downloaded: true, statusCode };
	} catch (error) {
		output?.error(`Error downloading file ${itemName}`, error);
		return { downloaded: false, statusCode };
	}
}

export async function downloadWPCLI() {
	return downloadFile({
		url: WP_CLI_URL,
		destinationFilePath: getWpCliPath(),
		itemName: 'wp-cli',
	});
}

async function downloadFileAndUnzip({
	url,
	destinationFolder,
	checkFinalPath,
	itemName,
}): Promise<DownloadFileAndUnzipResult> {
	if (fs.existsSync(checkFinalPath)) {
		output?.log(`${itemName} folder already exists. Skipping download.`);
		return { downloaded: false, statusCode: 0 };
	}

	let statusCode = 0;

	try {
		fs.ensureDirSync(path.dirname(destinationFolder));

		output?.log(`Downloading ${itemName}...`);
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
		output?.error(`Error downloading or unzipping ${itemName}:`, err);
	}
	return { downloaded: false, statusCode };
}

export async function downloadWordPress(
	wordPressVersion = DEFAULT_WORDPRESS_VERSION
) {
	const finalFolder = path.join(getWordpressVersionsPath(), wordPressVersion);
	const tempFolder = os.tmpdir();
	const { downloaded, statusCode } = await downloadFileAndUnzip({
		url: getWordPressVersionUrl(wordPressVersion),
		destinationFolder: tempFolder,
		checkFinalPath: finalFolder,
		itemName: `WordPress ${wordPressVersion}`,
	});
	if (downloaded) {
		fs.ensureDirSync(path.dirname(finalFolder));
		fs.moveSync(path.join(tempFolder, 'wordpress'), finalFolder, {
			overwrite: true,
		});
	} else if (404 === statusCode) {
		output?.log(
			`WordPress ${wordPressVersion} not found. Check https://wordpress.org/download/releases/ for available versions.`
		);
		process.exit(1);
	}
}

export async function downloadSqliteIntegrationPlugin() {
	return downloadFileAndUnzip({
		url: SQLITE_URL,
		destinationFolder: getWpNowPath(),
		checkFinalPath: getSqlitePath(),
		itemName: 'SQLite',
	});
}

export async function downloadMuPlugins() {
	fs.ensureDirSync(path.join(getWpNowPath(), 'mu-plugins'));
	fs.writeFile(
		path.join(getWpNowPath(), 'mu-plugins', '0-allow-wp-org.php'),
		`<?php
	// Needed because gethostbyname( 'wordpress.org' ) returns
	// a private network IP address for some reason.
	add_filter( 'allowed_redirect_hosts', function( $deprecated = '' ) {
		return array(
			'wordpress.org',
			'api.wordpress.org',
			'downloads.wordpress.org',
		);
	} );`
	);
}
