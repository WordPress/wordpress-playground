#!/usr/bin/env node
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
	getLegacyWordPressVersionMatrix,
	getWordPressDownloadFilename,
	getWordPressDownloadUrl,
} from './matrix.mjs';

const outputDir = process.argv[2];
if (!outputDir) {
	console.error('Usage: download-zips.mjs <output-dir>');
	process.exit(1);
}

await mkdir(outputDir, { recursive: true });

for (const { wp } of getLegacyWordPressVersionMatrix()) {
	const filename = getWordPressDownloadFilename(wp);
	const targetPath = join(outputDir, filename);
	if (await isCachedZip(targetPath)) {
		console.log(`Cached ${filename}`);
		continue;
	}

	await downloadZipWithRetries(getWordPressDownloadUrl(wp), targetPath);
}

async function downloadZipWithRetries(url, targetPath) {
	const filename = basename(targetPath);
	const attempts = 5;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			console.log(`Downloading ${filename} (${attempt}/${attempts})`);
			await downloadZip(url, targetPath);
			return;
		} catch (error) {
			await unlink(`${targetPath}.tmp`).catch(() => {});
			if (attempt === attempts) {
				throw error;
			}
			const delayMs = Math.min(60_000, 5_000 * 2 ** (attempt - 1));
			console.warn(
				`Failed to download ${filename}: ${error.message}. ` +
					`Retrying in ${Math.round(delayMs / 1000)}s.`
			);
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}
}

async function downloadZip(url, targetPath) {
	const response = await fetch(url, {
		headers: {
			'User-Agent': 'WordPress Playground CI legacy boot test',
		},
	});
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} from ${url}`);
	}
	const body = new Uint8Array(await response.arrayBuffer());
	if (body.length === 0) {
		throw new Error(`Empty response from ${url}`);
	}
	await writeFile(`${targetPath}.tmp`, body);
	await rename(`${targetPath}.tmp`, targetPath);
}

async function isCachedZip(path) {
	try {
		const stats = await stat(path);
		return stats.isFile() && stats.size > 0;
	} catch {
		return false;
	}
}
