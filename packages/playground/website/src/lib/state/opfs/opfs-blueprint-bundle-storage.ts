/**
 * Storage for blueprint bundles alongside persisted sites.
 *
 * When a temporary site is persisted, its blueprint bundle (including
 * blueprint.json and all bundled resources) is copied to the site's
 * storage directory under a versioned blueprint-bundle subdirectory.
 */

import {
	OpfsFilesystemBackend,
	copyFilesystem,
	type TraversableFilesystemBackend,
	type WritableFilesystemBackend,
} from '@wp-playground/storage';
import { basename, resolvePathUnder } from '@php-wasm/util';
import { getDirectoryPathForSlug } from './opfs-site-path';
import { runWithBlueprintFilesystemSnapshot } from '../blueprint-filesystem-write-coordinator';

export const BUNDLE_DIR_NAME = 'blueprint-bundle';
const VERSIONED_BUNDLE_DIR_PREFIX = 'blueprint-bundle-';

const blueprintBundleMutations = new Map<string, Promise<void>>();
const blueprintBundleOwner = Symbol('blueprintBundleOwner');

type BlueprintBundleOwner = {
	sitePath: string;
	directory: string;
	mutationKey: string;
	backend: WritableFilesystemBackend;
};

type SerializedBlueprintBundleBackend = WritableFilesystemBackend & {
	[blueprintBundleOwner]: BlueprintBundleOwner;
};

export type PersistedBlueprintBundle = {
	sitePath: string;
	directory: string;
	backend: WritableFilesystemBackend;
};

/** Checks whether an arbitrary Blueprint value can be traversed as files. */
export function isTraversableFilesystemBackend(
	value: unknown
): value is TraversableFilesystemBackend {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as Partial<TraversableFilesystemBackend>).read ===
			'function' &&
		typeof (value as Partial<TraversableFilesystemBackend>).listFiles ===
			'function' &&
		typeof (value as Partial<TraversableFilesystemBackend>).isDir ===
			'function'
	);
}

/** Get the legacy OPFS path for a site's Blueprint bundle directory. */
function getBundlePath(siteSlug: string): string {
	return getBundlePathForSitePath(getDirectoryPathForSlug(siteSlug));
}

/** Checks whether the legacy bundle directory contains any files. */
export async function hasBlueprintBundle(siteSlug: string): Promise<boolean> {
	try {
		const backend = await OpfsFilesystemBackend.fromPath(
			getBundlePath(siteSlug)
		);
		const files = await backend.listFiles('/');
		return files.length > 0;
	} catch {
		return false;
	}
}

/**
 * Writes a complete bundle into a new versioned directory.
 *
 * The current metadata keeps pointing at the previous complete directory until
 * the caller commits the returned directory name. A failed or interrupted copy
 * therefore leaves the current setup untouched. Reads from a live bundle are
 * held for the entire snapshot so editor writes cannot interleave with it.
 */
export async function persistBlueprintBundle(
	siteSlug: string,
	source: TraversableFilesystemBackend,
	currentBundle?: TraversableFilesystemBackend,
	currentSitePath?: string
): Promise<PersistedBlueprintBundle> {
	return runWithBlueprintFilesystemSnapshot(
		source,
		async (snapshotSource) => {
			const sourceOwner = (
				snapshotSource as Partial<SerializedBlueprintBundleBackend>
			)[blueprintBundleOwner];
			const currentOwner = (
				currentBundle as
					| Partial<SerializedBlueprintBundleBackend>
					| undefined
			)?.[blueprintBundleOwner];
			const sitePath =
				currentSitePath ??
				sourceOwner?.sitePath ??
				currentOwner?.sitePath ??
				getDirectoryPathForSlug(siteSlug);
			const sourceToCopy = sourceOwner?.backend ?? snapshotSource;
			const directory = `${VERSIONED_BUNDLE_DIR_PREFIX}${crypto.randomUUID()}`;
			const mutationKey = getBundlePathForSitePath(sitePath, directory);

			/** Copies and verifies the snapshot before its directory is selectable. */
			const copyIntoInactiveDirectory = async () => {
				try {
					const destination = await OpfsFilesystemBackend.fromPath(
						mutationKey,
						true
					);
					if ((await destination.listFiles('/')).length !== 0) {
						throw new Error(
							`New Blueprint bundle directory is not empty: ${directory}`
						);
					}
					await copyFilesystem(sourceToCopy, destination);
					return {
						sitePath,
						directory,
						backend: createSerializedBlueprintBundleBackend(
							{ sitePath, directory, mutationKey },
							destination
						),
					};
				} catch (error) {
					// The directory is not referenced until the caller commits metadata.
					// Remove failed UUID versions instead of leaking partial snapshots.
					try {
						const siteFilesystem =
							await OpfsFilesystemBackend.fromPath(sitePath);
						await siteFilesystem.rmdir(`/${directory}`, true);
					} catch {
						// Cleanup cannot make the previous selected version less valid.
					}
					throw error;
				}
			};

			if (sourceOwner) {
				return serializeBlueprintBundleMutation(
					sourceOwner.mutationKey,
					() =>
						serializeBlueprintBundleMutation(
							mutationKey,
							copyIntoInactiveDirectory
						)
				);
			}
			return serializeBlueprintBundleMutation(
				mutationKey,
				copyIntoInactiveDirectory
			);
		}
	);
}

/**
 * Deletes one version that durable site metadata does not select.
 *
 * Callers must first read authoritative metadata and keep the directory when it
 * is selected, including when a pending reset points at it for crash recovery.
 */
export async function deletePersistedBlueprintBundleVersion(
	siteSlug: string,
	directory: string,
	currentSitePath?: string
): Promise<void> {
	if (!directory.startsWith(VERSIONED_BUNDLE_DIR_PREFIX)) {
		throw new Error(
			`Cannot delete non-versioned Blueprint bundle: ${directory}`
		);
	}
	const sitePath = currentSitePath ?? getDirectoryPathForSlug(siteSlug);
	const mutationKey = getBundlePathForSitePath(sitePath, directory);
	await serializeBlueprintBundleMutation(mutationKey, async () => {
		const siteFilesystem = await OpfsFilesystemBackend.fromPath(sitePath);
		await siteFilesystem.rmdir(`/${directory}`, true);
	});
}

/** Deletes every supported bundle directory for a site. */
export async function deleteBlueprintBundle(siteSlug: string): Promise<void> {
	const sitePath = getDirectoryPathForSlug(siteSlug);
	let directories = [BUNDLE_DIR_NAME];
	try {
		const siteFilesystem = await OpfsFilesystemBackend.fromPath(sitePath);
		directories = [
			...directories,
			...(await siteFilesystem.listFiles('/')).filter((name) =>
				name.startsWith(VERSIONED_BUNDLE_DIR_PREFIX)
			),
		];
	} catch {
		// The site directory does not exist, so neither do its bundles.
	}
	for (const directory of directories) {
		const mutationKey = getBundlePathForSitePath(sitePath, directory);
		await serializeBlueprintBundleMutation(mutationKey, async () => {
			try {
				const backend =
					await OpfsFilesystemBackend.fromPath(mutationKey);
				await backend.clear();
			} catch {
				// Bundle doesn't exist, nothing to delete.
			}
		});
	}
}

/** Loads a site's selected persisted bundle as a serialized backend. */
export async function loadPersistedBlueprintBundle(
	siteSlug: string,
	directory = BUNDLE_DIR_NAME
): Promise<WritableFilesystemBackend> {
	return loadPersistedBlueprintBundleFromSitePath(
		getDirectoryPathForSlug(siteSlug),
		directory
	);
}

/**
 * Loads a persisted bundle from an already-resolved OPFS site path.
 *
 * This is used when a saved site's directory name is the legacy lossy form, so
 * recomputing the path from the slug would point at the newer encoded location.
 */
export async function loadPersistedBlueprintBundleFromPath(
	sitePath: string,
	directory = BUNDLE_DIR_NAME
): Promise<WritableFilesystemBackend> {
	return loadPersistedBlueprintBundleFromSitePath(sitePath, directory);
}

/** Loads one physical bundle path and coordinates all operations on it. */
async function loadPersistedBlueprintBundleFromSitePath(
	sitePath: string,
	directory: string
) {
	const mutationKey = getBundlePathForSitePath(sitePath, directory);
	return serializeBlueprintBundleMutation(mutationKey, async () => {
		const backend = await OpfsFilesystemBackend.fromPath(mutationKey);
		return createSerializedBlueprintBundleBackend(
			{ sitePath, directory, mutationKey },
			backend
		);
	});
}

/** Resolves a supported bundle directory without allowing site-root escape. */
function getBundlePathForSitePath(
	sitePath: string,
	directory = BUNDLE_DIR_NAME
): string {
	if (
		directory !== BUNDLE_DIR_NAME &&
		(!directory.startsWith(VERSIONED_BUNDLE_DIR_PREFIX) ||
			basename(directory) !== directory)
	) {
		throw new Error(`Invalid Blueprint bundle directory: ${directory}`);
	}
	const bundlePath = resolvePathUnder(directory, sitePath);
	if (!bundlePath) {
		throw new Error(`Invalid Blueprint bundle directory: ${directory}`);
	}
	return bundlePath;
}

/** Wraps a physical bundle so reads and writes share one path-level queue. */
function createSerializedBlueprintBundleBackend(
	owner: Omit<BlueprintBundleOwner, 'backend'>,
	backend: WritableFilesystemBackend
): SerializedBlueprintBundleBackend {
	/** Runs one backend call behind every operation for this physical path. */
	const run = <T>(operation: () => Promise<T>) =>
		serializeBlueprintBundleMutation(owner.mutationKey, operation);
	return {
		[blueprintBundleOwner]: { ...owner, backend },
		read: (path) => run(() => backend.read(path)),
		listFiles: (path) => run(() => backend.listFiles(path)),
		isDir: (path) => run(() => backend.isDir(path)),
		fileExists: (path) => run(() => backend.fileExists(path)),
		writeFile: (path, data) => run(() => backend.writeFile(path, data)),
		mkdir: (path, recursive) => run(() => backend.mkdir(path, recursive)),
		rmdir: (path, recursive) => run(() => backend.rmdir(path, recursive)),
		mv: (source, destination) => run(() => backend.mv(source, destination)),
		unlink: (path) => run(() => backend.unlink(path)),
		clear: () => run(() => backend.clear()),
	};
}

/** Serializes Blueprint bundle work targeting one physical OPFS path. */
async function serializeBlueprintBundleMutation<T>(
	mutationKey: string,
	mutation: () => Promise<T>
): Promise<T> {
	const previous =
		blueprintBundleMutations.get(mutationKey) ?? Promise.resolve();
	const current = previous
		.catch(() => undefined)
		.then(() => runWithBrowserLock(mutationKey, mutation));
	const completion = current.then(
		() => undefined,
		() => undefined
	);
	blueprintBundleMutations.set(mutationKey, completion);
	try {
		return await current;
	} finally {
		if (blueprintBundleMutations.get(mutationKey) === completion) {
			blueprintBundleMutations.delete(mutationKey);
		}
	}
}

/** Coordinates one physical OPFS bundle path across every browser tab. */
async function runWithBrowserLock<T>(
	mutationKey: string,
	mutation: () => Promise<T>
): Promise<T> {
	if (typeof navigator !== 'undefined' && navigator.locks) {
		return navigator.locks.request(
			`wordpress-playground-blueprint-bundle:${mutationKey}`,
			mutation
		);
	}
	return mutation();
}
