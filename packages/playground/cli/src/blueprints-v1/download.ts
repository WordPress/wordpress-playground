import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import fs from 'fs-extra';
import { createRequire } from 'module';
import os from 'os';
import path, { basename } from 'path';

export const CACHE_FOLDER = path.join(os.homedir(), '.wordpress-playground');

export async function fetchSqliteIntegration(
	version: 'trunk' | 'v2.1.16' | 'v3.0.0-rc.3-php52' = 'trunk'
): Promise<File> {
	// Production builds: the ZIP sits next to the bundled JS.
	const dir =
		typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;
	let zipPath = path.join(dir, 'sqlite-database-integration.zip');

	// Dev mode: locate via the wordpress-builds package.
	if (!fs.existsSync(zipPath)) {
		const require = createRequire(import.meta.url);
		const wpBuildsDir = path.dirname(
			require.resolve('@wp-playground/wordpress-builds/package.json')
		);
		zipPath = path.join(
			wpBuildsDir,
			'src',
			'sqlite-database-integration',
			`sqlite-database-integration-${version}.zip`
		);
	}

	return new File([await fs.readFile(zipPath)], path.basename(zipPath));
}

// @TODO: Support HTTP cache, invalidate the local file if the remote file has
// changed
export async function cachedDownload(
	remoteUrl: string,
	cacheKey: string,
	monitor: EmscriptenDownloadMonitor
) {
	const artifactPath = path.join(CACHE_FOLDER, cacheKey);
	if (!fs.existsSync(artifactPath)) {
		fs.ensureDirSync(CACHE_FOLDER);
		await downloadTo(remoteUrl, artifactPath, monitor);
	}
	return readAsFile(artifactPath);
}

async function downloadTo(
	remoteUrl: string,
	localPath: string,
	monitor: EmscriptenDownloadMonitor
) {
	const response = await monitor.monitorFetch(fetch(remoteUrl));
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
	return new File([fs.readFileSync(path)], fileName ?? basename(path));
}
