import type { SpawnedWorkerThread } from '@wordpress/php-wasm';
import { MemFile, pathJoin, writeFiles } from '../fs-utils';

export type Fixture = {
	name: string;
	files: MemFile[];
	build?: boolean;
};

export async function setupFixture(
	workerThread: SpawnedWorkerThread,
	fixture: Fixture,
	chroot: string
) {
	const fixturePath = `${chroot}/${fixture.name}`;

	let srcPath: string, buildPath: string;
	if (fixture.build) {
		srcPath = `${fixturePath}/src`;
		buildPath = `${fixturePath}/build`;
		await workerThread.mkdirTree(srcPath);
		await workerThread.mkdirTree(buildPath);
	} else {
		srcPath = buildPath = fixturePath;
		await workerThread.mkdirTree(fixturePath);
	}

	await writeFiles(workerThread, srcPath, fixture.files);
	await workerThread.writeFile(
		pathJoin(chroot, `${fixture.name}.php`),
		`<?php require_once "${buildPath}/index.php"; \n`
	);
	return { srcPath, buildPath };
}

import createBlockPluginFixture from './create-block-plugin';
import enableReactFastRefreshPluginFixture from './enable-react-fast-refresh';
export { createBlockPluginFixture, enableReactFastRefreshPluginFixture };
