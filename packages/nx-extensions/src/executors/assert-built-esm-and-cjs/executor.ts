import { ExecutorContext } from '@nrwl/devkit';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
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
	if (!existsSync(testsPath)) {
		mkdirSync(testsPath);
	}

	writeFileSync(
		path.join(testsPath, 'test-esm.mjs'),
		`import * as result from '../../${options.outputPath}/index.js';`
	);
	writeFileSync(
		path.join(testsPath, 'test-cjs.cjs'),
		`require('../../${options.outputPath}');`
	);
	writeFileSync(
		path.join(testsPath, 'test.sh'),
		`#!/bin/sh
set -e
node test-esm.mjs;
node test-cjs.cjs;
echo Success;`
	);

	// Run test.sh and check exit code:
	const test = spawnSync('sh', ['test.sh'], {
		cwd: testsPath,
		stdio: 'pipe',
		encoding: 'utf-8',
	});
	// Trim spaces and newlines
	const stdout = test.output.toString();
	const success =
		test.status === 0 && stdout.replace(/[^A-Za-z]/g, '') === 'Success';
	if (!success) {
		throw `${context.targetName} could not be imported as both ESM and CJS: ${stdout}`;
	}
	return {
		success,
	};
}
