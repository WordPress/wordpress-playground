import type { BuiltScriptExecutorSchema } from './schema';
import { spawnSync } from 'child_process';
import { join } from 'path';

// Weird, this is supposed to be a module, but it's not.
const dirname = __dirname;

function isValidArg(arg: unknown): arg is string {
	return typeof arg === 'string' && arg.length > 0;
}

export default async function runExecutor(options: BuiltScriptExecutorSchema) {
	const nodeArgs = (options.nodeArg || []).filter(isValidArg);
	const unparsedArgs = (options.__unparsed__ || []).filter(isValidArg);
	const args = [
		...nodeArgs,
		'--loader',
		join(dirname, 'loader.mjs'),
		options.scriptPath,
		...unparsedArgs,
	];
	const result = spawnSync('node', args, {
		stdio: 'inherit',
	});
	return {
		success: result.status === 0,
	};
}
