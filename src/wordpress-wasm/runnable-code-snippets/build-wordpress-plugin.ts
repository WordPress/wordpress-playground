import { cleanDirectory, readFiles, writeFiles } from './fs-utils';

import { bundle } from '../bundling/index';

type BuildOptions = {
	jsEntrypoint: string;
};

export async function buildWordPressPlugin(
	workerThread,
	srcPath,
	buildPath,
	options: Partial<BuildOptions> = {}
) {
	let { jsEntrypoint = 'index.js' } = options;
	await cleanDirectory(workerThread, buildPath);
	const sourceFiles = await readFiles(workerThread, srcPath);
	const { jsBundle, otherFiles } = await bundle(sourceFiles, jsEntrypoint);
	await writeFiles(workerThread, buildPath, otherFiles.concat([jsBundle]));
	return jsBundle;
}
