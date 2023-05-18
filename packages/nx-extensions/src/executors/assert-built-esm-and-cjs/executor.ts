import { ExecutorContext } from '@nx/devkit';
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import { AssertBuiltEsmAndCjsExecutorSchema } from './schema';

/**
 * Test whether a module can be imported as both ESM and CJS.
 *
 * @param options
 * @param context
 * @returns
 */
export default async function runExecutor(
	options: AssertBuiltEsmAndCjsExecutorSchema,
	context: ExecutorContext
) {
	const buildDir = options.outputPath.split('/')[0];
	const testsPath = path.join(context.root, buildDir, 'test-esm-cjs');
	mkdirSync(testsPath, { recursive: true });

	writeFileSync(
		path.join(testsPath, 'test-esm.mjs'),
		`import * as result from '../../${options.outputPath}/index.js';`
	);
	writeFileSync(
		path.join(testsPath, 'test-cjs.cjs'),
		`require('../../${options.outputPath}');`
	);
	const checkForSuccess = (scriptName) =>
		new Promise((resolve, reject) => {
			const test = spawn('node', [scriptName], {
				cwd: testsPath,
				stdio: 'pipe',
			});

			let stdout = '';
			test.stdout!.on('data', (chunk) => (stdout += chunk));

			let stderr = '';
			test.stderr!.on('data', (chunk) => (stderr += chunk));

			test.on('close', (statusCode) => {
				return statusCode === 0
					? resolve(stdout)
					: reject(
							`${context.targetName} could not be imported as both ESM and CJS: ${stdout} ${stderr}`
					  );
			});
		});

	await checkForSuccess('test-esm.mjs');
	await checkForSuccess('test-cjs.cjs');
	return { success: true };
}
