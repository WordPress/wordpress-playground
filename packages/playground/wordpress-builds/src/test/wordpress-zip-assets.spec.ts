import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// eslint-disable-next-line @nx/enforce-module-boundaries -- in-package build helper
import { normalizeEntries, readUstarTar } from '../../build/lib/tar-ustar.mjs';
// zstddec (WASM) decodes the tar.zst on any Node version; node:zlib zstd would
// need Node >= 22.15, but the CI unit-test job runs Node 20.
import { ZSTDDecoder } from 'zstddec/stream';

const wordpressBuildsDirectory = new URL('../wordpress/', import.meta.url);

describe('WordPress core bundle assets', () => {
	it.each([
		['../evil.php', /path traversal/],
		['/tmp/evil.php', /absolute/],
		['wp-content\\evil.php', /backslash/],
	])('fails loudly for unsafe source entry %s', (name, message) => {
		expect(() =>
			normalizeEntries({
				[name]: new Uint8Array(),
			})
		).toThrow(message);
	});

	it('ships CSS files that WordPress core reads from PHP', async () => {
		const bundles = getWordPressBundleFiles();
		expect(
			bundles.length,
			'Expected at least one wp-*.tar.zst build artifact'
		).toBeGreaterThan(0);

		let bundlesWithViewTransitions = 0;

		for (const bundle of bundles) {
			const bundlePath = fileURLToPath(
				new URL(`../wordpress/${bundle}`, import.meta.url)
			);
			const files = await listBundleFiles(bundlePath);

			expect(files.has('wordpress-static.zip')).toBe(false);

			if (!files.has('wp-includes/view-transitions.php')) {
				continue;
			}

			bundlesWithViewTransitions++;
			expect(files.has('wp-admin/css/view-transitions.css')).toBe(true);
			expect(files.has('wp-admin/css/view-transitions.min.css')).toBe(
				true
			);
		}

		expect(
			bundlesWithViewTransitions,
			'Expected at least one WordPress bundle with wp-includes/view-transitions.php'
		).toBeGreaterThan(0);
	});
});

function getWordPressBundleFiles() {
	return readdirSync(wordpressBuildsDirectory).filter((fileName) =>
		/^wp-.*\.tar\.zst$/.test(fileName)
	);
}

async function listBundleFiles(bundlePath: string): Promise<Set<string>> {
	const compressed = new Uint8Array(readFileSync(bundlePath));
	const decoder = new ZSTDDecoder();
	await decoder.init();
	const chunks = [...decoder.decodeStreaming([compressed])] as Uint8Array[];
	const tar = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
	const entries = readUstarTar(tar) as Array<{ name: string }>;
	return new Set(entries.map((entry) => entry.name));
}
