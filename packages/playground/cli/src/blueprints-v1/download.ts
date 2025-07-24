import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import fs from 'fs-extra';
import os from 'os';
import path, { basename } from 'path';

export const CACHE_FOLDER = path.join(os.homedir(), '.wordpress-playground');

interface CacheMetadata {
	etag?: string;
	lastModified?: string;
	downloadedAt: number;
}

export async function fetchSqliteIntegration(
	monitor: EmscriptenDownloadMonitor
) {
	const sqliteZip = await cachedDownload(
		'https://github.com/WordPress/sqlite-database-integration/archive/refs/heads/develop.zip',
		'sqlite.zip',
		monitor
	);
	return sqliteZip;
}

export async function cachedDownload(
	remoteUrl: string,
	cacheKey: string,
	monitor: EmscriptenDownloadMonitor
) {
	const artifactPath = path.join(CACHE_FOLDER, cacheKey);
	const metadataPath = path.join(CACHE_FOLDER, `${cacheKey}.metadata.json`);

	// Check if file exists and if it needs to be re-downloaded
	if (fs.existsSync(artifactPath)) {
		try {
			// Load existing metadata for conditional request headers
			let metadata: CacheMetadata | null = null;
			if (fs.existsSync(metadataPath)) {
				try {
					metadata = JSON.parse(
						fs.readFileSync(metadataPath, 'utf-8')
					);
				} catch {
					// If metadata is corrupted, re-download
					metadata = null;
				}
			}

			// Use fetch with conditional headers - it will automatically handle
			// If-None-Match and If-Modified-Since based on provided headers
			const headers: HeadersInit = {};
			if (metadata?.etag) {
				headers['If-None-Match'] = metadata.etag;
			}
			if (metadata?.lastModified) {
				headers['If-Modified-Since'] = metadata.lastModified;
			}

			// Make a conditional request
			const response = await fetch(remoteUrl, {
				method: 'HEAD',
				headers,
				cache: 'no-cache',
			});

			// If we get 304 Not Modified, use the cached version
			if (response.status === 304) {
				return readAsFile(artifactPath);
			}

			// If we have headers but no 304, the file has changed
			if (metadata && (metadata.etag || metadata.lastModified)) {
				// File has changed, will re-download below
			} else {
				// No cache headers available, fall back to time-based check
				// Re-download if file is older than 24 hours
				const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
				if (metadata && metadata.downloadedAt >= oneDayAgo) {
					return readAsFile(artifactPath);
				}
			}
		} catch (error) {
			// If we can't check the remote file (network issue, etc.),
			// use the cached version if it exists
			console.warn(
				'Unable to check remote file, using cached version:',
				error
			);
			return readAsFile(artifactPath);
		}
	}

	fs.ensureDirSync(CACHE_FOLDER);
	await downloadTo(remoteUrl, artifactPath, metadataPath, monitor);
	return readAsFile(artifactPath);
}

async function downloadTo(
	remoteUrl: string,
	localPath: string,
	metadataPath: string,
	monitor: EmscriptenDownloadMonitor
) {
	const response = await monitor.monitorFetch(fetch(remoteUrl));

	// Extract cache headers for metadata
	const etag = response.headers.get('etag');
	const lastModified = response.headers.get('last-modified');

	const reader = response.body!.getReader();
	const tmpPath = `${localPath}.partial`;
	const writer = fs.createWriteStream(tmpPath);

	while (true) {
		const { done, value } = await reader.read();
		if (value) {
			writer.write(value);
		}
		if (done) {
			break;
		}
	}

	writer.close();
	if (!writer.closed) {
		await new Promise((resolve, reject) => {
			writer.on('finish', () => {
				fs.renameSync(tmpPath, localPath);

				// Save metadata
				const metadata: CacheMetadata = {
					downloadedAt: Date.now(),
				};
				if (etag) metadata.etag = etag;
				if (lastModified) metadata.lastModified = lastModified;

				fs.writeFileSync(
					metadataPath,
					JSON.stringify(metadata, null, 2)
				);
				resolve(null);
			});
			writer.on('error', (err: any) => {
				fs.removeSync(tmpPath);
				reject(err);
			});
		});
	}
}

export function readAsFile(path: string, fileName?: string): File {
	const buffer = fs.readFileSync(path);
	// Convert Buffer to Uint8Array to fix the linter error
	const uint8Array = new Uint8Array(buffer);
	return new File([uint8Array], fileName ?? basename(path));
}
