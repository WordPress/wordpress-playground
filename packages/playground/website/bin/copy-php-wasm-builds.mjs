/**
 * Adds the published web PHP builds to a website build under a versioned
 * path:
 *
 *   php-wasm/<version>/web-<php>/{jspi,asyncify}/...
 *
 * <version> is the release in lerna.json. Each web-<php> directory holds the
 * @php-wasm/web-<php> package that @php-wasm/web@<version> depends on, as
 * published on npm. Lerna doesn't republish unchanged packages, so that's
 * not always <version> itself, but it's what npm users of <version> get. A
 * URL therefore never changes and pairs with @php-wasm/universal at the same
 * version, and a page that bundles @php-wasm/universal can load the runtime
 * from playground.wordpress.net instead of shipping it.
 *
 * The deploy workflow runs this after the website build. It's not part of the
 * build itself, because Lerna builds before it publishes, when <version>
 * isn't on npm yet. If it still isn't when this runs, nothing is added, and
 * the deploy keeps serving earlier versions.
 *
 * Usage: node copy-php-wasm-builds.mjs <output directory>
 */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = process.argv[2];
if (!output) {
	throw new Error('Usage: copy-php-wasm-builds.mjs <output directory>');
}

// npm's own errors stay in the thrown error instead of the log.
const npm = (...args) =>
	execFileSync('npm', [...args, '--loglevel=error'], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});

const { version } = JSON.parse(
	await readFile(join(root, 'lerna.json'), 'utf8')
);

let dependencies;
try {
	dependencies = JSON.parse(
		npm('view', `@php-wasm/web@${version}`, 'dependencies', '--json')
	);
} catch {
	console.warn(
		`@php-wasm/web@${version} isn't on npm yet; no php-wasm runtimes added.`
	);
	process.exit(0);
}

const downloads = await mkdtemp(join(tmpdir(), 'php-wasm-'));
try {
	for (const [name, packageVersion] of Object.entries(dependencies)) {
		const match = name.match(/^@php-wasm\/web-(\d+-\d+)$/);
		if (!match) {
			continue;
		}
		const tarball = npm(
			'pack',
			`${name}@${packageVersion}`,
			'--pack-destination',
			downloads
		)
			.trim()
			.split('\n')
			.pop();
		const target = join(output, version, `web-${match[1]}`);
		await mkdir(target, { recursive: true });
		execFileSync('tar', [
			'-xzf',
			join(downloads, tarball),
			'-C',
			target,
			'--strip-components=1',
		]);
		console.log(`${name}@${packageVersion} -> ${target}`);
	}
} finally {
	await rm(downloads, { recursive: true, force: true });
}
