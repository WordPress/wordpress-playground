/**
 * Install static releases with the real deployment script and test HTTP contracts.
 *
 * A local PHP server models WP Cloud: it serves existing public files directly,
 * denies hidden paths, and runs custom-redirects.php only for missing files.
 * Host headers select the app or WordPress hostname without DNS or TLS. This
 * checks installation and routing only: WP Cloud's Nginx deny rule, MIME types,
 * and edge behavior still need deployment checks.
 */
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import {
	chmod,
	cp,
	mkdtemp,
	mkdir,
	readFile,
	realpath,
	rm,
	stat,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const source = dirname(fileURLToPath(import.meta.url));
// Non-production names catch hardcoded hosts.
const app = 'https://app.example';
const wordpress = 'https://wordpress.example';
const temporary = await realpath(
	await mkdtemp(join(tmpdir(), 'playground-wpcloud-'))
);
const webRoot = join(temporary, 'htdocs');
const deployment = join(temporary, 'website-deployment');
const backups = join(temporary, 'backups');
const fakeBin = join(temporary, 'bin');
const phpCalls = join(temporary, 'php-calls.txt');
const purges = join(temporary, 'purges.txt');
const run = promisify(execFile);
let server;
let port;
try {
	await cp(join(source, '..'), deployment, { recursive: true });
	await cp(
		join(source, '../../../php-wasm/universal/src/lib/mime-types.json'),
		join(deployment, 'mime-types.json')
	);
	await mkdir(webRoot);
	await mkdir(fakeBin);
	// WP Cloud answers the hidden-path probes with 403 and accepts the edge purge.
	await writeFile(
		join(fakeBin, 'curl'),
		`#!/usr/bin/env node
if (process.argv.includes('-X')) {
    if (process.env.PLAYGROUND_TEST_PURGE_FAILURE === '1') {
        process.stderr.write('Fixture edge purge failed\\n');
        process.exit(22);
    }
    require('node:fs').appendFileSync(${JSON.stringify(purges)}, 'purged\\n');
    process.exit(0);
}
process.stdout.write(process.argv.at(-1).includes('/sw.js?') ? '200' : '403');
`
	);
	await chmod(join(fakeBin, 'curl'), 0o755);
	const env = {
		...process.env,
		PATH: `${fakeBin}:${process.env.PATH}`,
		SITE_PHP: (await run('which', ['php'])).stdout.trim(),
		SITE_API_BASE: 'https://api.example',
		ATOMIC_SITE_API_KEY: 'test',
		ATOMIC_SITE_ID: 'test',
	};
	const install = (release, upload, origins = [app, wordpress]) =>
		run(
			'bash',
			[
				join(deployment, 'apply-update.sh'),
				...origins,
				upload,
				webRoot,
				backups,
			],
			{ env: { ...env, PLAYGROUND_RELEASE_ID: release } }
		);
	const failure = (text) => (error) => error.stderr.includes(text);

	await assert.rejects(
		install('A', await makeBuild('A'), ['https://App.example', wordpress]),
		failure('canonical form')
	);
	await assert.rejects(
		install('A', await makeBuild('A'), [app, app]),
		failure('different hostnames')
	);
	await assert.rejects(
		install('B', await makeBuild('A')),
		failure('does not use /releases/B/')
	);
	const unchecked = await makeBuild('A');
	await writeFile(join(unchecked, 'remote.html'), 'remote without a check');
	await assert.rejects(install('A', unchecked), failure('do not check'));
	await rm(webRoot, { recursive: true });
	await mkdir(webRoot);

	await install('A', await makeBuild('A'));
	// PHP endpoints never enter the public tree, where Nginx would run them.
	await assert.rejects(stat(join(webRoot, 'releases/A/status.php')));
	await stat(join(webRoot, '.playground-releases/A/files/status.php'));
	assert.equal(
		await readFile(join(webRoot, 'sw.js'), 'utf8'),
		'import "/releases/A/sw.js";\n'
	);
	assert.equal(
		JSON.parse(await readFile(join(webRoot, 'release.json'), 'utf8'))
			.release,
		'A'
	);
	// Entry pages are copied to the root and kept in the release. Pages needing
	// custom headers, such as no-store index.html, stay PHP-served.
	for (const page of ['remote.html']) {
		assert.equal(
			await readFile(join(webRoot, page), 'utf8'),
			await readFile(join(webRoot, 'releases/A', page), 'utf8')
		);
	}
	await assert.rejects(stat(join(webRoot, 'index.html')));
	await assert.rejects(stat(join(webRoot, 'builder')));
	await assert.rejects(stat(join(webRoot, 'wp-6.8/templates/index.html')));

	port = await freePort();
	const router = join(temporary, 'nginx.php');
	await writeFile(
		router,
		`<?php
/** Model Nginx: deny hidden paths, serve existing files, otherwise run PHP. */
$path = rawurldecode( parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ) );
if ( preg_match( '~(^|/)\\.~', $path ) ) {
    http_response_code( 403 );
    return true;
}
if ( is_file( ${JSON.stringify(webRoot)} . $path ) && ! str_ends_with( $path, '.php' ) ) {
    return false;
}
file_put_contents( ${JSON.stringify(phpCalls)}, $path . "\\n", FILE_APPEND );
function __atomic_env_define( $name ) {}
class Atomic_Persistent_Data { public $GITHUB_TOKEN = 'fixture-token'; }
require ${JSON.stringify(join(webRoot, 'custom-redirects.php'))};
`
	);
	server = spawn('php', [
		'-d',
		'opcache.enable=0',
		'-S',
		`127.0.0.1:${port}`,
		'-t',
		webRoot,
		router,
	]);
	await once(server.stderr, 'data');

	// Release files and root copies are static on both hosts.
	for (const host of [app, wordpress]) {
		for (const path of [
			'/releases/A/assets/main.js',
			'/releases/A/wp-6.8/wp-includes/js/script.js',
			'/remote.html',
			'/sw.js',
		]) {
			assert.equal((await request(path, host)).status, 200, path);
		}
	}
	await assert.rejects(readFile(phpCalls)); // No static request reached PHP.

	// The app host's missing paths keep the existing handler: no-store entry pages,
	// native endpoints from the private directory, redirects, and SDK CORS.
	for (const path of ['/', '/api.html']) {
		const response = await request(path, app);
		assert.equal(response.status, 200, path);
		assert.match(response.headers.get('cache-control'), /no-store/);
	}
	assert.equal(await (await request('/status.php', app)).text(), 'A');
	const sdk = await request('/client/index.js', app);
	assert.equal(sdk.headers.get('access-control-allow-origin'), '*');
	assert.equal(
		(await request('/docs', app)).headers.get('location'),
		'https://wordpress.github.io/wordpress-playground/'
	);
	for (const path of [
		'/.playground-releases/A/files/status.php',
		'/%2eplayground-releases/A/files/status.php',
		'/releases/.staging-A/index.html',
	]) {
		assert.equal((await request(path, app)).status, 403, path);
	}

	// Existing app-handler contracts remain independent of Nginx-owned files.
	for (const [path, location] of [
		['/wordpress', 'wordpress.html'],
		['/builder/', 'builder.html'],
		['/builder/index.php', 'builder.html'],
	]) {
		const response = await request(path, app);
		assert.equal(response.status, 301, path);
		assert.equal(response.headers.get('location'), location, path);
	}
	const conditional = await request('/wordpress.html', app, {
		Referer: 'https://wordpress.org/example/',
	});
	assert.equal(conditional.status, 302);
	assert.equal(conditional.headers.get('location'), '/index.html');
	assert.equal(
		await (
			await request('/wordpress.html', app, {
				Referer: 'https://external.example/',
			})
		).text(),
		'wordpress A'
	);
	const proxy = await request('/plugin-proxy', app);
	assert.equal(proxy.status, 200);
	assert.equal(await proxy.text(), 'fixture-token');
	await symlink(
		join(temporary, 'outside.txt'),
		join(webRoot, 'releases/A/outside.txt')
	);
	await writeFile(join(temporary, 'outside.txt'), 'private');
	// Exercise the PHP boundary directly; the static/Nginx boundary has its own checks.
	for (const [path, status] of [
		['/outside.txt', 403],
		['/missing.js', 404],
		['/error.php?status=400', 400],
		['/error.php?status=500', 500],
	]) {
		const response = await request(path, app);
		assert.equal(response.status, status, path);
		assert.equal(response.headers.get('cache-control'), 'no-store', path);
		assert.equal(response.headers.get('a8c-edge-cache'), 'no-cache', path);
	}

	for (const path of ['/../outside.txt', '/%2e%2e/outside.txt'])
		assert.equal((await request(path, app)).status, 403, path);

	// The WordPress host runs no app handler or endpoint. Old clients' versioned
	// helper URLs receive the active release's helper.
	for (const path of ['/', '/api.html', '/status.php', '/client/index.js']) {
		assert.equal((await request(path, wordpress)).status, 404, path);
	}
	const helper = await request('/wordpress-bridge-abc123.html', wordpress);
	assert.equal(await helper.text(), 'helper A');
	assert.match(helper.headers.get('cache-control'), /no-store/);

	// A top-level navigation that no worker handled falls back to the app's
	// wrapper. Other requests must not redirect: iframes would nest wrappers.
	const scoped = '/scope:test/wp-admin/?preview=true&preview_nonce=a%2Bb';
	const navigation = { 'Sec-Fetch-Dest': 'document' };
	const redirect = await request(scoped, wordpress, navigation);
	assert.equal(redirect.status, 302);
	assert.equal(redirect.headers.get('location'), app + scoped);
	assert.equal(
		await (await request(scoped, app, navigation)).text(),
		'wrapper A'
	);
	for (const host of [app, wordpress]) {
		assert.equal(
			(await request(scoped, host, { 'Sec-Fetch-Dest': 'iframe' }))
				.status,
			404
		);
		assert.equal(
			(await request(scoped, host, navigation, 'POST')).status,
			404
		);
	}

	// A later release replaces the root files and keeps A for open tabs.
	await install('B', await makeBuild('B'));
	assert.match(
		await (await request('/remote.html', app)).text(),
		/remote B$/
	);
	assert.equal(
		await (await request('/releases/A/assets/main.js', app)).text(),
		'main A'
	);
	assert.equal(await (await request('/status.php', app)).text(), 'B');
	assert.match(
		await readFile(join(backups, 'B/remote.html'), 'utf8'),
		/remote A$/
	);
	assert.equal(
		await readFile(join(backups, 'B/sw.js'), 'utf8'),
		'import "/releases/A/sw.js";\n'
	);
	await assert.rejects(
		install('B', await makeBuild('B')),
		failure('already exists')
	);
	await assert.rejects(stat(join(webRoot, 'obsolete')));
	assert.equal(
		await readFile(join(webRoot, 'new-page.html'), 'utf8'),
		'new page'
	);
	// Manual rollback uses the same inventory and removes pages introduced by B.
	const retiredMetadata = join(
		webRoot,
		'.playground-releases/A/release.json'
	);
	const retired = JSON.parse(await readFile(retiredMetadata, 'utf8'));
	retired.inactiveSince = 1;
	await writeFile(retiredMetadata, JSON.stringify(retired));
	await assert.rejects(
		run(
			'bash',
			[
				join(deployment, 'apply-update.sh'),
				app,
				wordpress,
				'',
				webRoot,
				backups,
			],
			{
				env: {
					...env,
					PLAYGROUND_RELEASE_ID: 'A',
					PLAYGROUND_ROLLBACK_BACKUP: 'B',
					PLAYGROUND_TEST_PURGE_FAILURE: '1',
				},
			}
		),
		failure('Fixture edge purge failed')
	);
	assert.equal(
		JSON.parse(await readFile(join(webRoot, 'release.json'), 'utf8'))
			.release,
		'A'
	);
	await assert.rejects(stat(join(webRoot, 'new-page.html')));
	assert.equal(
		await readFile(join(webRoot, 'obsolete/page.html'), 'utf8'),
		'obsolete'
	);
	// Activation resets lifecycle metadata even when the subsequent purge fails.
	assert.equal(
		JSON.parse(await readFile(retiredMetadata, 'utf8')).inactiveSince,
		undefined
	);
	await install('post-rollback', await makeBuild('post-rollback'));
	await install(
		'after-post-rollback',
		await makeBuild('after-post-rollback')
	);
	await stat(join(webRoot, 'releases/A'));
	assert.ok(
		JSON.parse(await readFile(retiredMetadata, 'utf8')).inactiveSince > 1
	);
	// Restore A so the remaining failure/cleanup contracts exercise their original layout.
	await run(
		'bash',
		[
			join(deployment, 'apply-update.sh'),
			app,
			wordpress,
			'',
			webRoot,
			backups,
		],
		{
			env: {
				...env,
				PLAYGROUND_RELEASE_ID: 'A',
				PLAYGROUND_ROLLBACK_BACKUP: 'post-rollback',
			},
		}
	);

	// A directory blocks one rename after other root entries have been replaced.
	const broken = await makeBuild('C');
	await writeFile(join(broken, 'zz-blocked.html'), 'blocked');
	await mkdir(join(webRoot, 'zz-blocked.html'));
	await assert.rejects(
		install('C', broken),
		failure('previous root files restored')
	);
	assert.equal(
		JSON.parse(await readFile(join(webRoot, 'release.json'), 'utf8'))
			.release,
		'A'
	);
	assert.match(
		await readFile(join(webRoot, 'remote.html'), 'utf8'),
		/remote A$/
	);
	await assert.rejects(stat(join(webRoot, 'new-page.html')));
	assert.equal(
		await readFile(join(webRoot, 'obsolete/page.html'), 'utf8'),
		'obsolete'
	);
	// Retain an independent snapshot to exercise the original layout rollback too.
	await cp(join(backups, 'A'), join(backups, 'initial'), { recursive: true });
	// Retention removes expired inactive assets and private PHP, preserving rollback.
	for (const id of ['A', 'B', 'C']) {
		const path = join(webRoot, '.playground-releases', id, 'release.json');
		const metadata = JSON.parse(await readFile(path, 'utf8'));
		metadata.installedAt = 1;
		metadata.inactiveSince = id === 'B' ? Math.floor(Date.now() / 1000) : 1;
		await writeFile(path, JSON.stringify(metadata));
	}
	await install('D', await makeBuild('D'));
	await stat(join(webRoot, 'releases/A'));
	await stat(join(webRoot, 'releases/D'));
	// An old upload that only just became inactive receives the full window.
	await stat(join(webRoot, 'releases/B'));
	for (const id of ['C']) {
		await assert.rejects(stat(join(webRoot, 'releases', id)));
		await assert.rejects(stat(join(webRoot, '.playground-releases', id)));
		await assert.rejects(stat(join(backups, id)));
	}

	const expired = join(webRoot, '.playground-releases/B/release.json');
	const inactive = JSON.parse(await readFile(expired, 'utf8'));
	inactive.inactiveSince = 1;
	await writeFile(expired, JSON.stringify(inactive));

	// Cleanup is fallible after a consistent activation: edge purge must precede it.
	const purgeCount = (await readFile(purges, 'utf8')).split('\n').length;
	await mkdir(join(webRoot, '.playground-releases/corrupt'));
	await writeFile(
		join(webRoot, '.playground-releases/corrupt/release.json'),
		'{bad json'
	);
	await assert.rejects(
		install('E', await makeBuild('E')),
		failure('Syntax error')
	);
	assert.equal(
		JSON.parse(await readFile(join(webRoot, 'release.json'), 'utf8'))
			.release,
		'E'
	);
	assert.equal(
		(await readFile(purges, 'utf8')).split('\n').length,
		purgeCount + 1
	);
	await assert.rejects(stat(join(webRoot, 'releases/B')));

	// Rolling back the first transition also removes all newly introduced roots.
	await run(
		'bash',
		[
			join(deployment, 'apply-update.sh'),
			app,
			wordpress,
			'',
			webRoot,
			backups,
		],
		{
			env: {
				...env,
				PLAYGROUND_RELEASE_ID: 'A',
				PLAYGROUND_ROLLBACK_BACKUP: 'initial',
			},
		}
	);
	await assert.rejects(stat(join(webRoot, 'release.json')));
	await assert.rejects(stat(join(webRoot, 'remote.html')));
	await assert.rejects(stat(join(webRoot, 'new-page.html')));

	console.log(
		'Static release contracts passed: validation, layout, zero PHP static requests, ' +
			'host routing, native endpoints, scoped fallbacks, retained releases and backups.'
	);
} finally {
	server?.kill();
	await rm(temporary, { recursive: true, force: true });
}

/** Write a minimal build whose asset URLs name the given release. */
async function makeBuild(release) {
	const build = await mkdtemp(join(temporary, 'build-'));
	const files = {
		'index.html': `<script type="module" src="/releases/${release}/assets/main.js"></script>`,
		'api.html': `api ${release}`,
		'remote.html': `<script>if(location.origin!==${JSON.stringify(app)}){}</script>remote ${release}`,
		'wordpress-popup.html': `wrapper ${release}`,
		'wordpress-bridge.html': `helper ${release}`,
		'builder/builder.html': `builder ${release}`,
		'wordpress.html': `wordpress ${release}`,
		'plugin-proxy.php': '<?php echo getenv("GITHUB_TOKEN");',
		'error.php':
			'<?php http_response_code((int)($_GET["status"] ?? 200)); echo "endpoint";',
		...(release === 'A'
			? { 'obsolete/page.html': 'obsolete' }
			: { 'new-page.html': 'new page' }),
		'sw.js': `// worker ${release}`,
		'assets/main.js': `main ${release}`,
		'assets/runtime.wasm': 'runtime',
		'client/index.js': `sdk ${release}`,
		'status.php': `<?php echo ${JSON.stringify(release)};`,
		'wp-6.8/wp-includes/js/script.js': 'wordpress script',
		'wp-6.8/templates/index.html': '<!-- wp:paragraph --><p>Template</p>',
	};
	for (const [name, content] of Object.entries(files)) {
		await mkdir(dirname(join(build, name)), { recursive: true });
		await writeFile(join(build, name), content);
	}
	return build;
}

async function freePort() {
	const reservation = createServer();
	reservation.listen(0, '127.0.0.1');
	await once(reservation, 'listening');
	const { port } = reservation.address();
	await new Promise((resolve) => reservation.close(resolve));
	return port;
}

/**
 * Send a request to the local server while selecting a public host via Host.
 * Use node:http's raw path so encoded probes reach the server unchanged.
 */
function request(path, origin, headers = {}, method = 'GET') {
	return new Promise((resolve, reject) => {
		const outgoing = httpRequest(
			{
				hostname: '127.0.0.1',
				port,
				path,
				method,
				headers: { Host: new URL(origin).host, ...headers },
			},
			(incoming) => {
				const chunks = [];
				incoming.on('data', (chunk) => chunks.push(chunk));
				incoming.on('end', () => {
					const bytes = Buffer.concat(chunks);
					resolve(
						new Response(bytes.length ? bytes : null, {
							status: incoming.statusCode,
							headers: incoming.headers,
						})
					);
				});
			}
		);
		outgoing.on('error', reject);
		outgoing.end();
	});
}
