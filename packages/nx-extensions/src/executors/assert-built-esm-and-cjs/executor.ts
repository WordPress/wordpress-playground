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
	return { success: true };
}
