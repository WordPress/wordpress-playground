import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type {
	ExtensionManifestExtraFile,
	ExtensionManifestExtraFiles,
} from './manifest';

/**
 * Parses a `--extra-files` CLI argument of the form `<hostDir>:<vfsRoot>`.
 *
 * `vfsRoot` must be an absolute VFS path so the loader can stage files
 * without making up a default root. Splitting on the *last* colon lets
 * Windows host paths like `C:\dir:/internal/root` round-trip cleanly.
 */
export function parseExtraFilesSpec(spec: string): {
	hostDir: string;
	vfsRoot: string;
} {
	const separator = spec.lastIndexOf(':');
	if (separator < 0) {
		throw new Error(
			`Invalid --extra-files value ${JSON.stringify(
				spec
			)}. Expected "<hostDir>:<vfsRoot>".`
		);
	}
	const hostDir = spec.slice(0, separator);
	const vfsRoot = spec.slice(separator + 1);
	if (!hostDir || !vfsRoot) {
		throw new Error(
			`Invalid --extra-files value ${JSON.stringify(
				spec
			)}. Expected "<hostDir>:<vfsRoot>".`
		);
	}
	if (!vfsRoot.startsWith('/')) {
		throw new Error(
			`--extra-files vfsRoot must be an absolute VFS path. Received ${JSON.stringify(
				vfsRoot
			)}.`
		);
	}
	return { hostDir, vfsRoot };
}

/**
 * Copies one or more host directories into `outDir` and returns a manifest
 * `extraFiles` group whose `sourcePath` entries are relative to `outDir`.
 *
 * Each spec is `<hostDir>:<vfsRoot>`. All specs must agree on `vfsRoot`
 * because the manifest format only stores a single `vfsRoot` per group.
 *
 * Files keep their relative path under `vfsRoot`. Empty directories are
 * recorded as `type: 'directory'` nodes so the loader creates them.
 */
export async function stageExtraFilesIntoOutDir(
	specs: Array<{ hostDir: string; vfsRoot: string }>,
	outDir: string,
	workspaceRoot: string
): Promise<ExtensionManifestExtraFiles | undefined> {
	if (!specs.length) {
		return undefined;
	}
	const vfsRoot = specs[0].vfsRoot;
	for (const spec of specs) {
		if (spec.vfsRoot !== vfsRoot) {
			throw new Error(
				'All --extra-files entries must share the same vfsRoot. Received ' +
					JSON.stringify(specs.map((entry) => entry.vfsRoot))
			);
		}
	}

	const nodes: ExtensionManifestExtraFile[] = [];
	const claimedVfsPaths = new Set<string>();
	const claimedDestinations = new Set<string>();
	for (const spec of specs) {
		const absoluteHostDir = path.resolve(workspaceRoot, spec.hostDir);
		const targetSubdir = path.basename(absoluteHostDir);
		const destinationDir = path.join(outDir, targetSubdir);
		if (claimedDestinations.has(destinationDir)) {
			throw new Error(
				`--extra-files destination collides on disk: ${destinationDir}. ` +
					`Two host directories share the same basename, so one would overwrite the other.`
			);
		}
		claimedDestinations.add(destinationDir);
		await mkdir(path.dirname(destinationDir), { recursive: true });
		await cp(absoluteHostDir, destinationDir, { recursive: true });

		await walk(destinationDir, async (entryPath, isDirectory) => {
			const relativeUnderRoot = path
				.relative(destinationDir, entryPath)
				.split(path.sep)
				.join('/');
			if (!relativeUnderRoot) {
				return;
			}
			const sourcePath = `${targetSubdir}/${relativeUnderRoot}`;
			if (isDirectory) {
				const empty = (await readdir(entryPath)).length === 0;
				if (!empty) {
					return;
				}
				if (claimedVfsPaths.has(relativeUnderRoot)) {
					throw new Error(
						`--extra-files vfsPath collides across specs: ${relativeUnderRoot}.`
					);
				}
				claimedVfsPaths.add(relativeUnderRoot);
				nodes.push({
					vfsPath: relativeUnderRoot,
					type: 'directory',
				});
				return;
			}
			if (claimedVfsPaths.has(relativeUnderRoot)) {
				throw new Error(
					`--extra-files vfsPath collides across specs: ${relativeUnderRoot}.`
				);
			}
			claimedVfsPaths.add(relativeUnderRoot);
			nodes.push({
				vfsPath: relativeUnderRoot,
				sourcePath,
			});
		});
	}
	// Sort with a locale-independent comparator so the manifest is byte-stable
	// across machines (`localeCompare` honors the host locale).
	nodes.sort((a, b) =>
		a.vfsPath < b.vfsPath ? -1 : a.vfsPath > b.vfsPath ? 1 : 0
	);

	return {
		vfsRoot,
		nodes,
	};
}

async function walk(
	dir: string,
	visitor: (entryPath: string, isDirectory: boolean) => Promise<void>
): Promise<void> {
	for (const entry of await readdir(dir)) {
		const entryPath = path.join(dir, entry);
		const entryStat = await stat(entryPath);
		await visitor(entryPath, entryStat.isDirectory());
		if (entryStat.isDirectory()) {
			await walk(entryPath, visitor);
		}
	}
}
