import { cleanDirectory, readFiles, writeFiles } from './fs-utils';

import { bundle } from '../bundling/index';
import type { SpawnedWorkerThread } from '../../php-wasm-browser/index';

type BuildOptions = {
	jsEntrypoint: string;
	reloadOnly: boolean;
};

export async function buildWordPressPlugin(
	workerThread: SpawnedWorkerThread,
	srcPath,
	buildPath,
	options: Partial<BuildOptions> = {}
) {
	let { jsEntrypoint = 'index.js', reloadOnly = false } = options;
	await cleanDirectory(workerThread, buildPath);
	const sourceFiles = await readFiles(workerThread, srcPath);
	const { jsBundle, otherFiles } = await bundle(sourceFiles, jsEntrypoint, {
		reloadOnly,
	});
	await writeFiles(workerThread, buildPath, otherFiles.concat([jsBundle]));
	return jsBundle;
}
