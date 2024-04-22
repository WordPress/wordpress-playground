import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import fs from 'fs-extra';
import os from 'os';
import path, { basename } from 'path';

export const CACHE_FOLDER = path.join(os.homedir(), '.wordpress-playground');

async function downloadTo(
	url: string,
	destinationPath: string,
	monitor: EmscriptenDownloadMonitor
) {
	const response = await monitor.monitorFetch(fetch(url));
	const reader = response.body!.getReader();
	const writer = fs.createWriteStream(destinationPath);
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		writer.write(Buffer.from(value));
	}
}

// @TODO: Support HTTP cache, invalidate the local file if the remote file has changed
export async function cachedDownload(
	url: string,
	artifactName: string,
	monitor: EmscriptenDownloadMonitor
) {
	const artifactPath = path.join(CACHE_FOLDER, artifactName);
	if (!fs.existsSync(artifactPath)) {
		fs.ensureDirSync(CACHE_FOLDER);
		await downloadTo(url, artifactPath, monitor);
	}
	return readAsFile(artifactPath);
}

export function readAsFile(path: string, fileName?: string): File {
	return new File([fs.readFileSync(path)], fileName ?? basename(path));
}

export async function getWordPressVersionUrlAndName(version = 'latest') {
	if (version === 'trunk' || version === 'nightly') {
		return {
			url: 'https://wordpress.org/nightly-builds/wordpress-latest.zip',
			version: 'nightly-' + new Date().toISOString().split('T')[0],
		};
	}

	let latestVersions = await fetch(
		'https://api.wordpress.org/core/version-check/1.7/?channel=beta'
	).then((res) => res.json());

	latestVersions = latestVersions.offers.filter(
		(v: any) => v.response === 'autoupdate'
	);

	for (const apiVersion of latestVersions) {
		if (version === 'beta' && apiVersion.version.includes('beta')) {
			return {
				url: apiVersion.download,
				version: apiVersion.version,
			};
		} else if (version === 'latest') {
			return {
				url: apiVersion.download,
				version: apiVersion.version,
			};
		} else if (
			apiVersion.version.substring(0, version.length) === version
		) {
			return {
				url: apiVersion.download,
				version: apiVersion.version,
			};
		}
	}

	return {
		url: `https://wordpress.org/wordpress-${version}.zip`,
		version: version,
	};
}
