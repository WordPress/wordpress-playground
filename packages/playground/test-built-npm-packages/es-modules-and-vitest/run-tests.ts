/*
 * NOTE: We would prefer to run tests in a single process,
 * but we have encountered V8 crashes with both Vitest and the Node.js test runner
 * when calling Playgroun CLI's runCLI() function multiple times.
 *
 * So here is a manual test runner that spawns a new node test process for each PHP version.
 *
 * !! If we can manage to call runCLI() twice in a row in a process,
 * we might be able to return to using Vitest. 🙏
 */
import { SupportedPHPVersions } from '@php-wasm/universal';
import { spawn } from 'child_process';

function green(text: string) {
	return `\x1b[32m${text}\x1b[0m`;
}
function red(text: string) {
	return `\x1b[31m${text}\x1b[0m`;
}

type Result = {
	phpVersion: string;
	code: number | null;
	timeout?: boolean;
};

const results: Result[] = [];

// Exclude PHP 7.2 – it often times out on CI.
for (const phpVersion of SupportedPHPVersions.filter(
	(phpVersion: string) => !['7.2', '7.3'].includes(phpVersion)
)) {
	console.log(`\nRunning tests for PHP ${phpVersion}...`);

	const child = spawn(
		process.execPath,
		[
			'--experimental-strip-types',
			'--experimental-transform-types',
			'--test',
			'./tests/wp.spec.ts',
		],
		{
			env: {
				PHP_VERSION: phpVersion,
			},
			stdio: 'inherit',
		}
	);

	const promiseToClose = new Promise<void>((resolve) => {
		child.on('close', (code) => {
			results.push({
				phpVersion,
				code,
			});
			resolve();
		});
	});
	const promiseToTimeout = new Promise<void>((resolve, reject) => {
		setTimeout(() => {
			console.error(`PHP ${phpVersion}: timed out.`);
			reject(new Error('Test timed out'));
		}, 30000);
	});
	try {
		await Promise.race([promiseToClose, promiseToTimeout]);
	} catch (e) {
		results.push({
			phpVersion,
			code: null,
			timeout: true,
		});
		child.kill('SIGKILL');
	}
}

console.log('Results:');
for (const result of results) {
	if (result.timeout) {
		console.log(red(`PHP ${result.phpVersion}: ${red('timed out')}.`));
	} else {
		console.log(
			`PHP ${result.phpVersion}: ${
				result.code === 0 ? green('PASS') : red('FAIL')
			} with exit code ${result.code}`
		);
	}
}

const numPassed = results.filter((r) => r.code === 0).length;
const numFailed = results.filter((r) => r.code !== 0 && !r.timeout).length;
const numTimedOut = results.filter((r) => r.timeout).length;
if (numPassed > 0) {
	console.log(green(`${numPassed} / ${results.length} tests passed`));
}
if (numFailed > 0) {
	console.log(red(`${numFailed} / ${results.length} tests failed`));
}
if (numTimedOut > 0) {
	console.log(red(`${numTimedOut} / ${results.length} tests timed out`));
}

if (numFailed > 0) {
	process.exit(1);
}
