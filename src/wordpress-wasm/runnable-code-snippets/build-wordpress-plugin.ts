import { cleanDirectory, readFiles, writeFiles } from './fs-utils';

import { bundle } from '../bundling/index';

export async function buildWordPressPlugin(
	workerThread,
	srcPath,
	buildPath,
	{ jsEntrypoint = 'index.js' } = {}
) {
	await cleanDirectory(workerThread, buildPath);
	const sourceFiles = await readFiles(workerThread, srcPath);
	const builtChunks = await bundle(sourceFiles, jsEntrypoint);
	await writeFiles(workerThread, buildPath, builtChunks);
}
