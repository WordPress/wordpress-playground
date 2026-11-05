/**
 * Adds the published web PHP builds to the website build under a versioned
 * path:
 *
 *   php-wasm/<version>/web-<php>/{jspi,asyncify}/...
 *
 * Each directory holds the contents of the @php-wasm/web-<php> npm package at
 * <version>, the release in lerna.json. They come from npm rather than from
 * the working tree, so a URL always serves exactly what npm published, never
 * changes, and pairs with @php-wasm/universal at the same version. A page that
 * bundles @php-wasm/universal can then load the runtime from
 * playground.wordpress.net instead of shipping it.
 *
 * Usage: node copy-php-wasm-builds.mjs <output directory>
 */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = process.argv[2];
if (!output) {
	throw new Error('Usage: copy-php-wasm-builds.mjs <output directory>');
}

const { version } = JSON.parse(
	await readFile(join(root, 'lerna.json'), 'utf8')
);
const buildsDir = join(root, 'packages/php-wasm/web-builds');
const downloads = await mkdtemp(join(tmpdir(), 'php-wasm-'));

try {
	for (const entry of await readdir(buildsDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}
		const { name } = JSON.parse(
			await readFile(join(buildsDir, entry.name, 'package.json'), 'utf8')
		);
		const tarball = execFileSync(
			'npm',
			[
				'pack',
				`${name}@${version}`,
				'--pack-destination',
				downloads,
				'--loglevel=error',
			],
			{ encoding: 'utf8' }
		)
			.trim()
			.split('\n')
			.pop();
		const target = join(output, version, `web-${entry.name}`);
		await mkdir(target, { recursive: true });
		execFileSync('tar', [
			'-xzf',
			join(downloads, tarball),
			'-C',
			target,
			'--strip-components=1',
		]);
		console.log(`${name}@${version} -> ${target}`);
	}
} finally {
	await rm(downloads, { recursive: true, force: true });
}
