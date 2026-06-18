import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Uint8ArrayReader, ZipReader } from '@zip.js/zip.js';

const wordpressBuildsDirectory = new URL('../wordpress/', import.meta.url);

describe('WordPress zip assets', () => {
	it('ships CSS files that WordPress core reads from PHP', async () => {
		const zipFiles = getWordPressZipFiles();
		expect(
			zipFiles.length,
			'Expected at least one wp-*.zip build artifact'
		).toBeGreaterThan(0);

		let zipFilesWithViewTransitions = 0;

		for (const zipFile of zipFiles) {
			const zipPath = fileURLToPath(
				new URL(`../wordpress/${zipFile}`, import.meta.url)
			);
			const files = await listZipFiles(zipPath);

			if (!files.has('wp-includes/view-transitions.php')) {
				continue;
			}

			zipFilesWithViewTransitions++;
			expect(files.has('wp-admin/css/view-transitions.css')).toBe(true);
			expect(files.has('wp-admin/css/view-transitions.min.css')).toBe(
				true
			);
		}

		expect(
			zipFilesWithViewTransitions,
			'Expected at least one WordPress zip with wp-includes/view-transitions.php'
		).toBeGreaterThan(0);
	});
});

function getWordPressZipFiles() {
	return readdirSync(wordpressBuildsDirectory).filter((fileName) =>
		/^wp-.*\.zip$/.test(fileName)
	);
}

async function listZipFiles(zipPath: string) {
	const zipBuffer = await readFile(zipPath);
	const zipData = new Uint8Array(
		zipBuffer.buffer,
		zipBuffer.byteOffset,
		zipBuffer.byteLength
	);
	const reader = new ZipReader(new Uint8ArrayReader(zipData));
	try {
		const entries = await reader.getEntries();
		return new Set(entries.map((entry) => entry.filename));
	} finally {
		await reader.close();
	}
}
