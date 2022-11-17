import {
	cleanDirectory,
	getExtension,
	MemFile,
	readFiles,
	writeFiles,
} from './fs-utils';

import { bundle, transpileWordPressJsx } from '../bundling/index';

export async function buildWordPressPlugin(
	workerThread,
	srcPath,
	buildPath,
	{ jsEntrypoint = 'index.js' } = {}
) {
	await cleanDirectory(workerThread, buildPath);
	const sourceFiles = await readFiles(workerThread, srcPath);
	const isJs = ({ fileName }) =>
		['js', 'jsx'].includes(getExtension(fileName));
	const jsFiles = sourceFiles.filter((file) => isJs(file));
	const nonJsFiles = sourceFiles.filter((file) => !isJs(file));

	const transpiledJsFiles = await Promise.all(
		jsFiles.map(({ contents, ...rest }) => ({
			...rest,
			...transpileWordPressJsx(contents),
		}))
	);

	const allUsedWpAssets: string[] = Array.from(
		new Set(
			transpiledJsFiles.flatMap(({ usedWpAssets }) => usedWpAssets || [])
		)
	);

	const builtFiles = (transpiledJsFiles as MemFile[]).concat(nonJsFiles);

	const assetsAsPHPArray = allUsedWpAssets
		.map((x) => JSON.stringify(x))
		.join(', ');

	const indexAssetPhp = {
		fileName: 'index.asset.php',
		contents: `<?php return array('dependencies' => array(${assetsAsPHPArray}), 'version' => '6b9f26bada2f399976e5');\n`,
	};
	await writeFiles(
		workerThread,
		buildPath,
		nonJsFiles.concat([indexAssetPhp])
	);

	const modules = await bundle(builtFiles, jsEntrypoint);
	await writeFiles(workerThread, buildPath, modules);
}
