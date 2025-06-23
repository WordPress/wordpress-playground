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
};

const results: Result[] = [];

for (const phpVersion of SupportedPHPVersions) {
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

	await new Promise<void>((resolve) => {
		child.on('close', (code) => {
			results.push({
				phpVersion,
				code,
			});
			resolve();
		});
	});
}

console.log('Results:');
for (const result of results) {
	console.log(
		`PHP ${result.phpVersion}: ${
			result.code === 0 ? green('PASS') : red('FAIL')
		} with exit code ${result.code}`
	);
}

const numPassed = results.filter((r) => r.code === 0).length;
const numFailed = results.filter((r) => r.code !== 0).length;
if (numPassed > 0) {
	console.log(green(`${numPassed} / ${results.length} tests passed`));
}
if (numFailed > 0) {
	console.log(red(`${numFailed} / ${results.length} tests failed`));
}

if (numFailed > 0) {
	process.exit(1);
}
