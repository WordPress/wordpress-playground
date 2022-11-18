import type { SpawnedWorkerThread } from '../../../php-wasm-browser/index';
import { MemFile, MU_PLUGINS_PATH, pathJoin, writeFiles } from '../fs-utils';

export type Fixture = {
	name: string;
	files: MemFile[];
};

export async function setupFixture(
	workerThread: SpawnedWorkerThread,
	fixture: Fixture
) {
	const fixurePath = `${MU_PLUGINS_PATH}/${fixture.name}`;
	const srcPath = `${fixurePath}/src`;
	const buildPath = `${fixurePath}/build`;

	await workerThread.mkdirTree(srcPath);
	await writeFiles(workerThread, srcPath, fixture.files);

	await workerThread.mkdirTree(buildPath);
	await workerThread.writeFile(
		pathJoin(MU_PLUGINS_PATH, `${fixture.name}.php`),
		`<?php require_once "${buildPath}/index.php"; \n`
	);
	return { srcPath, buildPath };
}
