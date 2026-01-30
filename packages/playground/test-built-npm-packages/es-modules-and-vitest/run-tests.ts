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
const timeoutMs = Number.parseInt(
	process.env.PER_PHP_TEST_TIMEOUT_MS ?? '60000',
	10
);
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
	throw new Error(
		`Invalid PER_PHP_TEST_TIMEOUT_MS value: "${process.env.PER_PHP_TEST_TIMEOUT_MS}"`
	);
}

for (const phpVersion of SupportedPHPVersions) {
	console.log(`\nRunning tests for PHP ${phpVersion}...`);

	const child = spawn(
		process.execPath,
		[
			'--experimental-strip-types',
			'--experimental-transform-types',
			'--test',
			'--test-concurrency=1',
			'./tests/wp.spec.ts',
		],
		{
			env: {
				...process.env,
				PHP_VERSION: phpVersion,
			},
			stdio: 'inherit',
		}
	);

	let timeoutHandle: NodeJS.Timeout | undefined;
	const promiseToClose = new Promise<number | null>((resolve) => {
		child.on('close', (code) => resolve(code));
	});
	const promiseToTimeout = new Promise<never>((_, reject) => {
		timeoutHandle = setTimeout(() => {
			reject(new Error(`Test timed out after ${timeoutMs}ms`));
		}, timeoutMs);
	});

	try {
		const code = await Promise.race([promiseToClose, promiseToTimeout]);
		results.push({
			phpVersion,
			code,
		});
	} catch (e) {
		console.error(`PHP ${phpVersion}: timed out after ${timeoutMs}ms.`);
		results.push({
			phpVersion,
			code: null,
			timeout: true,
		});
		child.kill('SIGKILL');
		await promiseToClose;
	} finally {
		if (timeoutHandle) {
			clearTimeout(timeoutHandle);
		}
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

if (numFailed > 0 || numTimedOut > 0) {
	process.exit(1);
}
