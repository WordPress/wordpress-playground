/**
 * Build a client from the root-only production layout once, for the opt-in
 * root-layout transition test.
 *
 * Builds deployed between the WordPress sandbox host and release directories install
 * a WordPress worker that answers its own bridge URL with HTML naming that build's
 * root /wordpress-bridge-<hash>.js. Reproducing what happens to such a client after
 * a deployment needs a real build of that era, made for the test's origins, plus the
 * installer that deployed it. Building takes 10–15 minutes, so the result is kept in
 * dist/ and reused while its commit and origins match. Nothing is committed.
 *
 * Output: dist/packages/playground/root-layout-client/
 *   build/       the build, as uploaded by that era's deployment workflow
 *   deployment/  that commit's website-deployment directory and MIME map
 *   build.json   the commit and origins it was built for
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appOrigin, wordPressOrigin } from './origins.mjs';

// The last commit deployed with the root-only layout, before release directories.
const commit = '3898d9fa9a594b6804e1f83eab196b3162f7a9ea';
// The transition test serves both web roots on the deployment tests' port.
const app = new URL(appOrigin);
const wordpress = new URL(wordPressOrigin);
app.port = wordpress.port = '7999';
const stamp = {
	commit,
	appOrigin: app.origin,
	wordPressOrigin: wordpress.origin,
};
const output = 'dist/packages/playground/root-layout-client';

if (
	existsSync(`${output}/build.json`) &&
	readFileSync(`${output}/build.json`, 'utf8') === JSON.stringify(stamp)
) {
	console.log(`Reusing the root-only layout client in ${output}.`);
	process.exit(0);
}

const run = (command, args, options = {}) =>
	execFileSync(command, args, { stdio: 'inherit', ...options });
try {
	execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`]);
} catch {
	run('git', ['fetch', '--depth=1', 'origin', commit]);
}
const checkout = await mkdtemp(join(tmpdir(), 'playground-root-layout-'));
run('git', ['worktree', 'add', '--detach', checkout, commit]);
try {
	run('npm', ['ci'], { cwd: checkout });
	run('npm', ['run', 'sync:php-next'], { cwd: checkout });
	run('npx', ['nx', 'build', 'playground-website', '--skip-nx-cache'], {
		cwd: checkout,
		env: {
			...process.env,
			NX_DAEMON: 'false',
			PLAYGROUND_APP_ORIGIN: stamp.appOrigin,
			VITE_WORDPRESS_SITE_URL: stamp.wordPressOrigin,
		},
	});
	await rm(output, { recursive: true, force: true });
	await cp(
		join(checkout, 'dist/packages/playground/wasm-wordpress-net'),
		`${output}/build`,
		{ recursive: true, verbatimSymlinks: true }
	);
	await cp(
		join(checkout, 'packages/playground/website-deployment'),
		`${output}/deployment`,
		{ recursive: true }
	);
	await cp(
		join(checkout, 'packages/php-wasm/universal/src/lib/mime-types.json'),
		`${output}/deployment/mime-types.json`
	);
	await writeFile(`${output}/build.json`, JSON.stringify(stamp));
	console.log(`Built the root-only layout client in ${output}.`);
} finally {
	run('git', ['worktree', 'remove', '--force', checkout]);
}
