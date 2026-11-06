import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request } from '@playwright/test';
import { basename, isParentOf, joinPaths } from '@php-wasm/util';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { removePathPrefix } from '../../storage/src/lib/paths';
import {
	Uint8ArrayReader,
	Uint8ArrayWriter,
	ZipReader,
	ZipWriter,
} from '@zip.js/zip.js';
import type { BlueprintV1Declaration } from '@wp-playground/blueprints';

// Update these together when refreshing the real Personal WP launch fixture.
const blueprintsRevision = '620985d9f0e89317ebcfa66efabbda789a4130c3';
const myAppsRevision = '6a575777e55c4e9ff645cef7cc80a0c4c34e1fe7';

/** Download pinned launch assets once and expose named ZIPs through the local Vite server. */
export default async function globalSetup() {
	// Keep assets inside the existing remote-server allow list and outside Playwright's output cleanup.
	const fixturesRoot = joinPaths(__dirname, 'test-results');
	await mkdir(fixturesRoot, { recursive: true });
	const directory = await mkdtemp(joinPaths(fixturesRoot, 'launch-assets-'));
	const api = await request.newContext({
		timeout: 120_000,
		failOnStatusCode: true,
	});
	try {
		const response = await api.get(
			`https://raw.githubusercontent.com/WordPress/blueprints/${blueprintsRevision}/blueprints/my-wordpress/blueprint.json`
		);
		const blueprint: BlueprintV1Declaration = await response.json();
		for (const step of blueprint.steps || []) {
			if (
				!step ||
				typeof step !== 'object' ||
				step.step !== 'installPlugin' ||
				step.pluginData.resource !== 'git:directory'
			) {
				continue;
			}
			const resource = step.pluginData;
			const revision =
				resource.url === 'https://github.com/WordPress/blueprints'
					? blueprintsRevision
					: resource.url === 'https://github.com/akirk/my-apps'
						? myAppsRevision
						: undefined;
			if (!revision) {
				throw new Error(`Unpinned Personal WP plugin: ${resource.url}`);
			}
			const repository = new URL(resource.url).pathname;
			const archive = await api.get(
				`https://codeload.github.com${repository}/zip/${revision}`
			);
			const zip = await pluginZip(await archive.body(), resource.path);
			step.options = {
				...step.options,
				targetFolderName:
					step.options?.targetFolderName ||
					basename(resource.path || repository),
			};
			const zipPath = joinPaths(
				directory,
				`${step.options.targetFolderName}.zip`
			);
			await writeFile(zipPath, zip);
			step.pluginData = {
				resource: 'url',
				// Personal WP's dev server permits filesystem assets, including these temporary ZIPs.
				url: new URL(
					joinPaths('/@fs', zipPath),
					'http://127.0.0.1:5401'
				).href,
			};
		}
		const blueprintPath = joinPaths(directory, 'blueprint.json');
		await writeFile(blueprintPath, JSON.stringify(blueprint));
		// Playwright passes setup's environment to every worker, including replacement workers.
		process.env.PERSONAL_WP_TEST_BLUEPRINT = blueprintPath;
	} catch (error) {
		await rm(directory, { recursive: true, force: true });
		throw error;
	} finally {
		await api.dispose();
	}
	return () => rm(directory, { recursive: true, force: true });
}

/** Keep only the plugin subtree, with all binary file contents intact. */
async function pluginZip(archive: Uint8Array, pluginPath = '') {
	const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(archive)));
	const writer = new ZipWriter(new Uint8ArrayWriter());
	try {
		const entries = await reader.getEntries();
		const root = entries.find((entry) => entry.directory)?.filename;
		if (!root) {
			throw new Error('GitHub archive has no root directory');
		}
		const prefix = joinPaths(root, pluginPath, '/');
		for (const entry of entries) {
			if (entry.directory || !isParentOf(prefix, entry.filename)) {
				continue;
			}
			const relative = removePathPrefix(entry.filename, prefix);
			const contents = await entry.getData!(new Uint8ArrayWriter());
			await writer.add(relative, new Uint8ArrayReader(contents));
		}
		return await writer.close();
	} finally {
		await reader.close();
	}
}
