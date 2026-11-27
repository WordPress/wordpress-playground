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
	utimes,
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
    require('node:fs').appendFileSync(${JSON.stringify(purges)}, process.argv.at(-1) + '\\n');
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
	const install = (
		release,
		upload,
		{
			origins = [app, wordpress],
			root = webRoot,
			snapshots = backups,
			environment = {},
		} = {}
	) =>
		run(
			'bash',
			[
				join(deployment, 'apply-update.sh'),
				...origins,
				upload,
				root,
				snapshots,
			],
			{ env: { ...env, PLAYGROUND_RELEASE_ID: release, ...environment } }
		);
	// Rollback runs the installer on the server with no build, origins or release ID.
	const rollback = (target, extraEnv = {}) =>
		run('bash', [join(deployment, 'apply-update.sh'), webRoot, backups], {
			env: { ...env, PLAYGROUND_ROLLBACK: target, ...extraEnv },
		});
	const retryPurge = (extraEnv = {}) =>
		run('bash', [join(deployment, 'apply-update.sh'), webRoot, backups], {
			env: { ...env, PLAYGROUND_PURGE_ONLY: '1', ...extraEnv },
		});
	// Contract: both entry points wait for the same host lock before changing files.
	// A second shell can otherwise interleave a rollback with activation's root writes.
	const whileLocked = async (start, unchanged) => {
		const holder = spawn(env.SITE_PHP, [
			'-r',
			'$lock = fopen($argv[1], "c"); flock($lock, LOCK_EX); echo "locked\\n"; fgets(STDIN);',
			join(webRoot, '.playground-deployment.lock'),
		]);
		await once(holder.stdout, 'data');
		const operation = start();
		try {
			// The installer reports contention before its blocking flock call.
			await once(operation.child.stdout, 'data');
			await unchanged();
		} finally {
			holder.stdin.end('\n');
			await once(holder, 'exit');
			await operation;
		}
	};
	const failure = (text) => (error) =>
		error.stderr.includes(text) || error.stdout.includes(text);

	// The running installer must retain the lock even if its PHP parent is killed.
	const lockGate = join(temporary, 'release-lock');
	const lockedScript = join(temporary, 'locked-installer.sh');
	await writeFile(
		lockedScript,
		'echo running; while [ ! -f "$2" ]; do sleep 0.05; done\n'
	);
	const lockHolder = spawn(env.SITE_PHP, [
		join(deployment, 'apply-update.php'),
		'with-lock',
		webRoot,
		lockedScript,
		lockGate,
	]);
	const holderExit = once(lockHolder, 'exit');
	await once(lockHolder.stdout, 'data');
	const tryLock = () =>
		run(env.SITE_PHP, [
			'-r',
			'$lock = fopen($argv[1], "c"); exit(flock($lock, LOCK_EX | LOCK_NB) ? 0 : 1);',
			join(webRoot, '.playground-deployment.lock'),
		]);
	try {
		await assert.rejects(tryLock());
		lockHolder.kill('SIGTERM');
		await holderExit;
		await assert.rejects(tryLock());
	} finally {
		await writeFile(lockGate, 'release');
		await run(
			env.SITE_PHP,
			[
				'-r',
				'$lock = fopen($argv[1], "c"); flock($lock, LOCK_EX);',
				join(webRoot, '.playground-deployment.lock'),
			],
			{ timeout: 5000 }
		);
	}

	await assert.rejects(
		install('A', await makeBuild('A'), {
			origins: ['https://App.example', wordpress],
		}),
		failure('canonical form')
	);
	await assert.rejects(
		install('A', await makeBuild('A'), { origins: [app, app] }),
		failure('different hostnames')
	);
	await assert.rejects(
		install('B', await makeBuild('A')),
		failure('does not use /releases/B/')
	);
	const unchecked = await makeBuild('A');
	await writeFile(join(unchecked, 'remote.html'), 'remote without a check');
	await assert.rejects(
		install('A', unchecked),
		failure('remote.html does not check for https://app.example')
	);
	// Every page is checked, including copied pages, and the bridge names the sandbox.
	const nested = await makeBuild('A');
	await writeFile(
		join(nested, 'builder/builder.html'),
		'builder without a check'
	);
	await assert.rejects(
		install('A', nested),
		failure('builder/builder.html does not check')
	);
	const bridgeOnApp = await makeBuild('A');
	await writeFile(
		join(bridgeOnApp, 'wordpress-bridge.html'),
		guard(app) + 'bridge'
	);
	await assert.rejects(
		install('A', bridgeOnApp),
		failure('does not check for https://wordpress.example')
	);
	// Nginx follows links, so they may name only build files, relative to themselves.
	await writeFile(join(temporary, 'outside.txt'), 'private');
	for (const [name, target] of [
		['assets/escape.js', '../../outside.txt'],
		['assets/absolute.js', null],
	]) {
		const linked = await makeBuild('A');
		await symlink(
			target ?? join(linked, 'assets/main.js'),
			join(linked, name)
		);
		await assert.rejects(
			install('A', linked),
			failure(`${name} links outside the build`)
		);
	}
	await rm(webRoot, { recursive: true });
	await mkdir(webRoot);

	for (const key of ['ATOMIC_SITE_API_KEY', 'ATOMIC_SITE_ID']) {
		const upload = await makeBuild('A');
		await assert.rejects(
			install('A', upload, { environment: { [key]: '' } }),
			failure(`Expected ${key}`)
		);
		await stat(upload);
		await assert.rejects(stat(join(webRoot, '.playground-releases/A')));
	}

	const first = await makeBuild('A');
	await symlink('main.js', join(first, 'assets/alias.js'));
	await install('A', first);
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
/** Model Nginx: deny hidden paths except /.well-known/, serve existing files, otherwise run PHP. */
$path = rawurldecode( parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ) );
if ( preg_match( '~(^|/)\\.~', $path ) && ! str_starts_with( $path, '/.well-known/' ) ) {
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
			'/releases/A/assets/alias.js',
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
	// The AI discovery manifest lives in the release; WP Cloud lets /.well-known/ reach PHP.
	assert.equal(
		await (await request('/.well-known/mcp.json', app)).text(),
		'manifest A'
	);
	const sdk = await request('/client/index.js', app);
	assert.equal(sdk.headers.get('access-control-allow-origin'), '*');
	assert.equal(
		(await request('/docs', app)).headers.get('location'),
		'https://wordpress.github.io/wordpress-playground/'
	);
	for (const path of [
		'/.playground-releases/A/files/status.php',
		'/%2eplayground-releases/A/files/status.php',
		'/.playground-releases/.staging-A/index.html',
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
	assert.match(
		await (
			await request('/wordpress.html', app, {
				Referer: 'https://external.example/',
			})
		).text(),
		/wordpress A$/
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
	// bridge URLs receive the active release's bridge.
	for (const path of ['/', '/api.html', '/status.php', '/client/index.js']) {
		assert.equal((await request(path, wordpress)).status, 404, path);
	}
	const bridge = await request('/wordpress-bridge-abc123.html', wordpress);
	assert.match(await bridge.text(), /bridge A$/);
	assert.match(bridge.headers.get('cache-control'), /no-store/);

	// A top-level navigation that no worker handled falls back to the app's
	// wrapper. Other requests must not redirect: iframes would nest wrappers.
	const scoped = '/scope:test/wp-admin/?preview=true&preview_nonce=a%2Bb';
	const navigation = { 'Sec-Fetch-Dest': 'document' };
	const redirect = await request(scoped, wordpress, navigation);
	assert.equal(redirect.status, 302);
	assert.equal(redirect.headers.get('location'), app + scoped);
	assert.match(
		await (await request(scoped, app, navigation)).text(),
		/wrapper A$/
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
	const uploadB = await makeBuild('B');
	await whileLocked(
		() => install('B', uploadB),
		async () => {
			await stat(uploadB);
			assert.equal(
				JSON.parse(
					await readFile(join(webRoot, 'release.json'), 'utf8')
				).release,
				'A'
			);
		}
	);
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
	assert.match(
		await readFile(join(webRoot, 'new-page.html'), 'utf8'),
		/new page$/
	);
	// Manual rollback uses the same inventory and removes pages introduced by B.
	const retiredMetadata = join(
		webRoot,
		'.playground-releases/A/release.json'
	);
	const retired = JSON.parse(await readFile(retiredMetadata, 'utf8'));
	retired.inactiveSince = 1;
	await writeFile(retiredMetadata, JSON.stringify(retired));
	const rootBeforeMissingCredentials = await readFile(
		join(webRoot, 'release.json')
	);
	for (const key of ['ATOMIC_SITE_API_KEY', 'ATOMIC_SITE_ID']) {
		await assert.rejects(
			rollback('previous', { [key]: '' }),
			failure(`Expected ${key}`)
		);
		assert.deepEqual(
			await readFile(join(webRoot, 'release.json')),
			rootBeforeMissingCredentials
		);
	}
	// "previous" undoes the live release's deployment: B, restoring A.
	await assert.rejects(
		rollback('previous', { PLAYGROUND_TEST_PURGE_FAILURE: '1' }),
		failure('Fixture edge purge failed')
	);
	assert.equal(
		JSON.parse(await readFile(join(webRoot, 'release.json'), 'utf8'))
			.release,
		'A'
	);
	await assert.rejects(stat(join(webRoot, 'new-page.html')));
	assert.match(
		await readFile(join(webRoot, 'obsolete/page.html'), 'utf8'),
		/obsolete$/
	);
	// Activation resets lifecycle metadata even when the subsequent purge fails.
	assert.equal(
		JSON.parse(await readFile(retiredMetadata, 'utf8')).inactiveSince,
		undefined
	);
	await assert.rejects(
		rollback('previous'),
		failure('An edge purge is pending')
	);
	await assert.rejects(
		retryPurge({ PLAYGROUND_TEST_PURGE_FAILURE: '1' }),
		failure('Fixture edge purge failed')
	);
	await retryPurge();
	assert.equal(
		JSON.parse(await readFile(join(webRoot, 'release.json'), 'utf8'))
			.release,
		'A'
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
	// Naming a release undoes its deployment; the live release.json supplies the hosts.
	const purgesBeforeRollback = (await readFile(purges, 'utf8')).split('\n');
	await whileLocked(
		() => rollback('post-rollback'),
		async () => {
			assert.equal(
				JSON.parse(
					await readFile(join(webRoot, 'release.json'), 'utf8')
				).release,
				'after-post-rollback'
			);
		}
	);
	assert.deepEqual(
		(await readFile(purges, 'utf8'))
			.split('\n')
			.slice(purgesBeforeRollback.length - 1, -1),
		[
			'https://api.example/edge-cache/test/purge/app.example',
			'https://api.example/edge-cache/test/purge/wordpress.example',
		]
	);

	// A directory blocks one rename after other root entries have been replaced.
	const broken = await makeBuild('C');
	await writeFile(join(broken, 'zz-blocked.html'), guard(app) + 'blocked');
	await mkdir(join(webRoot, 'zz-blocked.html'));
	const purgesBeforeFailedActivation = (await readFile(purges, 'utf8')).split(
		'\n'
	).length;
	await assert.rejects(
		install('C', broken),
		failure('previous root files restored')
	);
	assert.deepEqual(
		(await readFile(purges, 'utf8'))
			.split('\n')
			.slice(purgesBeforeFailedActivation - 1, -1),
		[
			'https://api.example/edge-cache/test/purge/app.example',
			'https://api.example/edge-cache/test/purge/wordpress.example',
		]
	);
	await assert.rejects(stat(join(backups, 'pending-edge-purge')));
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
	assert.match(
		await readFile(join(webRoot, 'obsolete/page.html'), 'utf8'),
		/obsolete$/
	);
	// An upload that fails before activation is still recorded for retention.
	await assert.rejects(
		run(
			'bash',
			[
				join(deployment, 'apply-update.sh'),
				app,
				wordpress,
				await makeBuild('F'),
				webRoot,
				backups,
			],
			{
				env: {
					...env,
					PLAYGROUND_RELEASE_ID: 'F',
					PLAYGROUND_MIME_TYPES: join(temporary, 'missing.json'),
				},
			}
		)
	);
	await stat(join(webRoot, '.playground-releases/.staging-F'));
	// Retain an independent snapshot to exercise the original layout rollback too.
	await cp(join(backups, 'A'), join(backups, 'initial'), { recursive: true });
	// Retention removes expired inactive assets and private PHP, preserving rollback.
	for (const id of ['A', 'B', 'C', 'F']) {
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
	for (const id of ['C', 'F']) {
		await assert.rejects(stat(join(webRoot, 'releases', id)));
		await assert.rejects(stat(join(webRoot, '.playground-releases', id)));
		await assert.rejects(stat(join(backups, id)));
	}
	await assert.rejects(
		stat(join(webRoot, '.playground-releases/.staging-F'))
	);

	// Cleanup failure/retry: public, backup and private-directory deletions must
	// fail loudly and keep lifecycle metadata, even if its file was already unlinked.
	for (const kind of ['public', 'backup', 'private']) {
		const id = `cleanup-${kind}`;
		const publicPath = join(webRoot, 'releases', id);
		const privatePath = join(webRoot, '.playground-releases', id);
		const snapshotPath = join(backups, id);
		for (const directory of [publicPath, privatePath, snapshotPath])
			await mkdir(directory);
		await writeFile(join(publicPath, 'asset.txt'), 'expired public file');
		await writeFile(join(snapshotPath, 'snapshot.txt'), 'expired backup');
		const metadataPath = join(privatePath, 'release.json');
		await writeFile(
			metadataPath,
			JSON.stringify({ release: id, inactiveSince: 1 })
		);
		const locked =
			kind === 'public'
				? publicPath
				: kind === 'backup'
					? snapshotPath
					: join(webRoot, '.playground-releases');
		await chmod(locked, 0o555);
		try {
			await assert.rejects(
				run(env.SITE_PHP, [
					join(deployment, 'apply-update.php'),
					'prune',
					webRoot,
					backups,
					'30',
				]),
				failure('Cannot remove')
			);
			assert.equal(
				JSON.parse(await readFile(metadataPath, 'utf8')).release,
				id
			);
		} finally {
			await chmod(locked, 0o755);
		}
		const retry = await run(env.SITE_PHP, [
			join(deployment, 'apply-update.php'),
			'prune',
			webRoot,
			backups,
			'30',
		]);
		assert.match(retry.stdout, new RegExp(`Expired release ${id}`));
		for (const directory of [publicPath, privatePath, snapshotPath])
			await assert.rejects(stat(directory));
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
	// WP Cloud's purge covers only the primary domain unless each host is named.
	assert.deepEqual(
		(await readFile(purges, 'utf8')).split('\n').slice(purgeCount - 1, -1),
		[
			'https://api.example/edge-cache/test/purge/app.example',
			'https://api.example/edge-cache/test/purge/wordpress.example',
		]
	);
	await assert.rejects(stat(join(webRoot, 'releases/B')));

	// Rolling back the first transition also removes all newly introduced roots.
	await assert.rejects(
		rollback('initial', { PLAYGROUND_TEST_PURGE_FAILURE: '1' }),
		failure('Fixture edge purge failed')
	);
	await assert.rejects(stat(join(webRoot, 'release.json')));
	await assert.rejects(stat(join(webRoot, 'remote.html')));
	await assert.rejects(stat(join(webRoot, 'new-page.html')));
	assert.equal(
		await readFile(join(backups, 'pending-edge-purge'), 'utf8'),
		'app.example\nwordpress.example\n'
	);
	await retryPurge();
	await assert.rejects(stat(join(backups, 'pending-edge-purge')));
	await assert.rejects(stat(join(webRoot, 'release.json')));
	await retryPurge(); // Retrying a completed purge is harmless and never rolls back again.

	// Untracked release retention: a prior active release without lifecycle metadata
	// must survive activation and later pruning, even when its files look expired.
	const isolatedRoot = join(temporary, 'untracked-site');
	const isolatedBackups = join(temporary, 'untracked-backups');
	const untrackedPaths = [
		join(isolatedRoot, 'releases/untracked'),
		join(isolatedRoot, '.playground-releases/untracked'),
	];
	for (const directory of untrackedPaths) {
		await mkdir(directory, { recursive: true });
		await writeFile(
			join(directory, 'keep.txt'),
			'untracked rollback files'
		);
		await utimes(directory, 1, 1);
	}
	await writeFile(
		join(isolatedRoot, 'release.json'),
		JSON.stringify({
			release: 'untracked',
			appOrigin: app,
			wordPressOrigin: wordpress,
		})
	);
	const isolated = { root: isolatedRoot, snapshots: isolatedBackups };
	for (const id of ['tracked-first', 'tracked-second'])
		await install(id, await makeBuild(id), isolated);
	await run(env.SITE_PHP, [
		join(deployment, 'apply-update.php'),
		'prune',
		isolatedRoot,
		isolatedBackups,
		'30',
	]);
	for (const directory of untrackedPaths)
		assert.equal(
			await readFile(join(directory, 'keep.txt'), 'utf8'),
			'untracked rollback files'
		);
	await assert.rejects(stat(join(untrackedPaths[1], 'release.json')));

	// Host lookup failures and empty output must not report a purge or prune files.
	const phpWrapper = join(fakeBin, 'php-with-host-errors');
	const phpBootstrap = join(temporary, 'php-bootstrap.php');
	// WP Cloud's auto-prepend removes shell settings before PHP files run. The
	// lock coordinator must preserve them for its child; PHP install steps need none.
	await writeFile(
		phpBootstrap,
		'<?php putenv("HOME"); putenv("PLAYGROUND_RELEASE_ID");'
	);
	await writeFile(
		phpWrapper,
		`#!/usr/bin/env node
if (process.argv[3] === 'prepare-purge' && ['failure', 'empty'].includes(process.env.PLAYGROUND_TEST_HOSTS_MODE)) {
    if (process.env.PLAYGROUND_TEST_HOSTS_MODE === 'failure') {
        process.stderr.write('Fixture host lookup failed\\n');
        process.exit(17);
    }
    process.exit(0);
}
const result = require('node:child_process').spawnSync(${JSON.stringify(env.SITE_PHP)}, ['-d', ${JSON.stringify(`auto_prepend_file=${phpBootstrap}`)}, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
`
	);
	await chmod(phpWrapper, 0o755);
	const rootBeforeBadLookup = await readFile(
		join(isolatedRoot, 'release.json')
	);
	for (const mode of ['failure', 'empty']) {
		await assert.rejects(
			run(
				'bash',
				[
					join(deployment, 'apply-update.sh'),
					isolatedRoot,
					isolatedBackups,
				],
				{
					env: {
						...env,
						PLAYGROUND_ROLLBACK: 'previous',
						SITE_PHP: phpWrapper,
						PLAYGROUND_TEST_HOSTS_MODE: mode,
					},
				}
			),
			failure(
				mode === 'failure'
					? 'Fixture host lookup failed'
					: 'No hostnames to purge'
			)
		);
		assert.deepEqual(
			await readFile(join(isolatedRoot, 'release.json')),
			rootBeforeBadLookup
		);
	}
	const keepUntilPurge = join(isolatedRoot, 'releases/waiting-for-purge');
	const waitingMetadata = join(
		isolatedRoot,
		'.playground-releases/waiting-for-purge'
	);
	await mkdir(keepUntilPurge);
	await mkdir(waitingMetadata);
	await writeFile(
		join(waitingMetadata, 'release.json'),
		JSON.stringify({ release: 'waiting-for-purge', inactiveSince: 1 })
	);
	for (const mode of ['failure', 'empty']) {
		const before = await readFile(purges, 'utf8');
		const id = `hosts-${mode}`;
		await assert.rejects(
			install(id, await makeBuild(id), {
				...isolated,
				environment: {
					SITE_PHP: phpWrapper,
					PLAYGROUND_TEST_HOSTS_MODE: mode,
				},
			}),
			failure(
				mode === 'failure'
					? 'Fixture host lookup failed'
					: 'No hostnames to purge'
			)
		);
		assert.equal(await readFile(purges, 'utf8'), before);
		await stat(keepUntilPurge);
		await stat(join(waitingMetadata, 'release.json'));
	}
	await install('after-host-errors', await makeBuild('after-host-errors'), {
		...isolated,
		environment: { SITE_PHP: phpWrapper },
	});
	await assert.rejects(stat(keepUntilPurge));
	await assert.rejects(stat(waitingMetadata));

	// An origin migration must purge both the departing and restored hostname pairs.
	const movedOrigins = [
		'https://app-moved.example',
		'https://wordpress-moved.example',
	];
	await install(
		'moved-origins',
		await makeBuild('moved-origins', movedOrigins),
		{
			...isolated,
			origins: movedOrigins,
		}
	);
	await assert.rejects(
		run(
			'bash',
			[
				join(deployment, 'apply-update.sh'),
				isolatedRoot,
				isolatedBackups,
			],
			{
				env: {
					...env,
					PLAYGROUND_ROLLBACK: 'previous',
					PLAYGROUND_TEST_PURGE_FAILURE: '1',
				},
			}
		),
		failure('Fixture edge purge failed')
	);
	assert.equal(
		JSON.parse(await readFile(join(isolatedRoot, 'release.json'), 'utf8'))
			.release,
		'after-host-errors'
	);
	assert.equal(
		await readFile(join(isolatedBackups, 'pending-edge-purge'), 'utf8'),
		'app-moved.example\nwordpress-moved.example\napp.example\nwordpress.example\n'
	);
	const purgesBeforeMigrationRetry = (await readFile(purges, 'utf8')).split(
		'\n'
	).length;
	await run(
		'bash',
		[join(deployment, 'apply-update.sh'), isolatedRoot, isolatedBackups],
		{
			env: { ...env, PLAYGROUND_PURGE_ONLY: '1' },
		}
	);
	assert.deepEqual(
		(await readFile(purges, 'utf8'))
			.split('\n')
			.slice(purgesBeforeMigrationRetry - 1, -1),
		[
			'https://api.example/edge-cache/test/purge/app-moved.example',
			'https://api.example/edge-cache/test/purge/wordpress-moved.example',
			'https://api.example/edge-cache/test/purge/app.example',
			'https://api.example/edge-cache/test/purge/wordpress.example',
		]
	);
	await assert.rejects(stat(join(isolatedBackups, 'pending-edge-purge')));

	console.log(
		'Static release contracts passed: validation, layout, zero PHP static requests, ' +
			'host routing, native endpoints, scoped fallbacks, retained releases and backups.'
	);
} finally {
	server?.kill();
	await rm(temporary, { recursive: true, force: true });
}

/** Write a minimal build whose asset URLs name the given release. */
async function makeBuild(release, origins = [app, wordpress]) {
	const build = await mkdtemp(join(temporary, 'build-'));
	const files = {
		'index.html': `<script type="module" src="/releases/${release}/assets/main.js"></script>`,
		'api.html': `api ${release}`,
		'remote.html': `remote ${release}`,
		'wordpress-popup.html': `wrapper ${release}`,
		'wordpress-bridge.html': `bridge ${release}`,
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
		'.well-known/mcp.json': `manifest ${release}`,
		'status.php': `<?php echo ${JSON.stringify(release)};`,
		'wp-6.8/wp-includes/js/script.js': 'wordpress script',
		'wp-6.8/templates/index.html': '<!-- wp:paragraph --><p>Template</p>',
	};
	for (const [name, content] of Object.entries(files)) {
		// The build guards every app page except WordPress's own documents.
		const page = name.endsWith('.html') && !name.startsWith('wp-');
		await mkdir(dirname(join(build, name)), { recursive: true });
		await writeFile(
			join(build, name),
			page
				? guard(
						name === 'wordpress-bridge.html'
							? origins[1]
							: origins[0]
					) + content
				: content
		);
	}
	return build;
}

/** The origin check the build places before a page's scripts. */
function guard(origin) {
	return `<script>if(location.origin!==${JSON.stringify(origin)}){}</script>`;
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
