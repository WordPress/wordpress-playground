import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const wordpressBuildsDirectory = new URL('../wordpress/', import.meta.url);

describe('WordPress zip assets', () => {
	it('ships CSS files that WordPress core reads from PHP', () => {
		for (const zipFile of getWordPressZipFiles()) {
			const zipPath = fileURLToPath(
				new URL(`../wordpress/${zipFile}`, import.meta.url)
			);
			const files = listZipFiles(zipPath);

			if (!files.has('wp-includes/view-transitions.php')) {
				continue;
			}

			expect(files.has('wp-admin/css/view-transitions.css')).toBe(true);
			expect(files.has('wp-admin/css/view-transitions.min.css')).toBe(
				true
			);
		}
	});
});

function getWordPressZipFiles() {
	return readdirSync(wordpressBuildsDirectory).filter((fileName) =>
		/^wp-.*\.zip$/.test(fileName)
	);
}

function listZipFiles(zipPath: string) {
	return new Set(
		execFileSync('unzip', ['-Z', '-1', zipPath], {
			encoding: 'utf8',
			maxBuffer: 1024 * 1024 * 8,
		})
			.split('\n')
			.filter(Boolean)
	);
}
