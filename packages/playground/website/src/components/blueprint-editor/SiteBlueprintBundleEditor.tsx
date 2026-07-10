import { logger } from '@php-wasm/logger';
import { dirname, ensureAbsolutePath } from '@php-wasm/util';
import { type Blueprint, BlueprintReflection } from '@wp-playground/blueprints';
import {
	type AsyncWritableFilesystem,
	EventedFilesystem,
	InMemoryFilesystemBackend,
	type WritableFilesystemBackend,
} from '@wp-playground/storage';
import classNames from 'classnames';
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from 'react';
import {
	isAutosavedSite,
	isExplicitlySavedSite,
	persistBlueprintBundleForSetup,
	type SiteInfo,
} from '../../lib/state/redux/slice-sites';
import { useAppDispatch } from '../../lib/state/redux/store';
import styles from './blueprint-bundle-editor.module.css';
import {
	type BlueprintBundleEditorHandle,
	BlueprintBundleEditor,
} from './BlueprintBundleEditor';
import { getBlueprintFilesystemIdentity } from './blueprint-filesystem-identity';
import { blueprintBundleLoadErrorSymbol } from '../../lib/state/opfs/opfs-site-storage';

const eventedFilesystemByBackend = new WeakMap<
	WritableFilesystemBackend,
	EventedFilesystem
>();
let temporaryBlueprintFilesystem:
	| {
			identity: string;
			filesystem: Promise<EventedFilesystem>;
	  }
	| undefined;

type BlueprintFilesystemLifecycle = 'temporary' | 'autosaved' | 'saved';

/**
 * Check if an object implements the writable filesystem backend interface.
 */
function isFilesystemBackend(obj: unknown): obj is WritableFilesystemBackend {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'listFiles' in obj &&
		'isDir' in obj &&
		'read' in obj &&
		'fileExists' in obj &&
		'writeFile' in obj &&
		'mkdir' in obj &&
		'rmdir' in obj &&
		'mv' in obj &&
		'unlink' in obj &&
		'clear' in obj
	);
}

/**
 * Populate a filesystem with the contents of a Blueprint.
 * Writes blueprint.json and all bundled resources.
 */
async function populateFilesystemFromBlueprint(
	fs: EventedFilesystem,
	blueprint: Blueprint
): Promise<void> {
	const reflection = await BlueprintReflection.create(blueprint);
	const declaration = reflection.getDeclaration();
	const bundle = reflection.getBundle();

	await fs.writeFile('/blueprint.json', JSON.stringify(declaration, null, 2));

	if (bundle) {
		for (const absolutePath of collectBundledResourcePaths(declaration)) {
			// For each path referenced in the blueprint, try to read the
			// accompanying file from the bundle. Some files might be missing,
			// this is fine – we'll just skip them here.
			let content: Uint8Array;
			try {
				const file = await bundle.read(absolutePath);
				content = new Uint8Array(await file.arrayBuffer());
			} catch {
				continue;
			}
			const parent = dirname(absolutePath);
			if (!(await fs.fileExists(parent))) {
				await fs.mkdir(parent, { recursive: true });
			}
			await fs.writeFile(absolutePath, content);
		}
	}
}

/**
 * Returns an editable filesystem for a site's Blueprint declaration or bundle.
 *
 * Bundle backends can be used directly. Declaration-only Blueprints are copied
 * into a fresh in-memory filesystem so the editor always works with files.
 */
async function createFilesystemFromOriginalBlueprint(
	originalBlueprint: SiteInfo['metadata']['originalBlueprint']
): Promise<EventedFilesystem> {
	if (originalBlueprint instanceof EventedFilesystem) {
		return originalBlueprint;
	}
	// If originalBlueprint is already a filesystem backend (e.g.,
	// PersistedBlueprintBundle), use it directly instead of populating from
	// Blueprint JSON.
	if (isFilesystemBackend(originalBlueprint)) {
		return getEventedFilesystem(originalBlueprint);
	}

	// Otherwise, populate an in-memory filesystem with the Blueprint JSON.
	const fs = getEventedFilesystem(new InMemoryFilesystemBackend());
	if (originalBlueprint) {
		await populateFilesystemFromBlueprint(
			fs,
			originalBlueprint as Blueprint
		);
	}
	return fs;
}

/** Reuses one event-emitting facade for each concrete storage backend. */
function getEventedFilesystem(backend: WritableFilesystemBackend) {
	let filesystem = eventedFilesystemByBackend.get(backend);
	if (!filesystem) {
		filesystem = new EventedFilesystem(backend);
		eventedFilesystemByBackend.set(backend, filesystem);
	}
	return filesystem;
}

/** Collects bundled resource paths referenced anywhere in a Blueprint. */
function collectBundledResourcePaths(value: unknown): Set<string> {
	const accumulator = new Set<string>();
	const stack: unknown[] = [value];
	while (stack.length) {
		const current = stack.pop();
		if (!current || typeof current !== 'object') {
			continue;
		}

		if (Array.isArray(current)) {
			for (const item of current) {
				stack.push(item);
			}
			continue;
		}

		const candidate = current as { resource?: unknown; path?: unknown };
		if (
			candidate.resource === 'bundled' &&
			typeof candidate.path === 'string'
		) {
			accumulator.add(ensureAbsolutePath(candidate.path));
		}

		for (const child of Object.values(current)) {
			stack.push(child);
		}
	}

	return accumulator;
}

export interface SiteBlueprintBundleEditorHandle {
	downloadBundle: () => Promise<void>;
	/** Returns the flushed bundle, or null before mounting or after a failed flush. */
	getBundle: () => Promise<AsyncWritableFilesystem | null>;
}

type SiteBlueprintBundleEditorProps = {
	className?: string;
	site: SiteInfo;
};

/**
 * Shell component – handles filesystem acquisition, then mounts the inner
 * editor with a stable filesystem instance.
 */
export const SiteBlueprintBundleEditor = forwardRef<
	SiteBlueprintBundleEditorHandle,
	SiteBlueprintBundleEditorProps
>(function SiteBlueprintBundleEditor({ className, site }, ref) {
	const dispatch = useAppDispatch();
	const [filesystemState, setFilesystemState] = useState<{
		identity: string;
		lifecycle: BlueprintFilesystemLifecycle;
		filesystem: EventedFilesystem;
	} | null>(null);

	const innerEditorRef = useRef<BlueprintBundleEditorHandle | null>(null);

	// Autosaved and explicitly saved Playgrounds both use OPFS, but they
	// represent different lifecycle states. Autosaves are recovery copies that
	// can still be reshaped by editing their Blueprint; explicit saves are
	// user-preserved site artifacts, so their Blueprints remain read-only.
	const isAutosaved = isAutosavedSite(site);
	const readOnly = isExplicitlySavedSite(site);
	const filesystemIdentity = getBlueprintFilesystemIdentity(site);
	const filesystemLifecycle: BlueprintFilesystemLifecycle =
		site.metadata.storage === 'none'
			? 'temporary'
			: isAutosaved
				? 'autosaved'
				: 'saved';
	const filesystem =
		filesystemState?.identity === filesystemIdentity
			? filesystemState.filesystem
			: null;
	const isFilesystemTransition = Boolean(
		filesystem && filesystemState?.lifecycle !== filesystemLifecycle
	);

	useEffect(() => {
		let cancelled = false;
		const previousFilesystemState =
			filesystemState?.identity === filesystemIdentity
				? filesystemState
				: null;
		if (previousFilesystemState?.lifecycle === filesystemLifecycle) {
			return;
		}

		/** Materializes the editable bundle for this site setup revision. */
		const createFilesystem = async () => {
			const bundleLoadError = (site.metadata as any)[
				blueprintBundleLoadErrorSymbol
			];
			if (bundleLoadError) {
				throw new Error(
					`Cannot load the saved Blueprint bundle for ${site.slug}.`,
					{ cause: bundleLoadError }
				);
			}
			let fs: EventedFilesystem;
			const temporaryFilesystemToPromote =
				isAutosaved &&
				previousFilesystemState?.lifecycle === 'temporary'
					? previousFilesystemState
					: null;
			if (temporaryFilesystemToPromote) {
				// Freeze and flush the temporary editor before copying its draft into
				// the autosave's durable Blueprint bundle.
				const flushedFilesystem =
					await innerEditorRef.current?.getBundle();
				if (
					flushedFilesystem !==
					temporaryFilesystemToPromote.filesystem
				) {
					throw new Error(
						'Blueprint filesystem initialization was superseded'
					);
				}
				fs = temporaryFilesystemToPromote.filesystem;
			} else {
				fs = await createFilesystemFromOriginalBlueprint(
					site.metadata.originalBlueprint
				);
			}
			if (
				(!isAutosaved && !temporaryFilesystemToPromote) ||
				(isFilesystemBackend(site.metadata.originalBlueprint) &&
					!temporaryFilesystemToPromote)
			) {
				return fs;
			}

			// Autosaved Playgrounds keep editable Blueprint bundles beside their
			// WordPress files. Copy a declaration-only bundle or the flushed temporary
			// draft into per-site OPFS so edits cannot leak into another site.
			// The serialized thunk owns setup validation because it keeps reading the
			// Redux store after this component unmounts. Closing the manager therefore
			// does not abandon the only edited draft, while a newer setup prevents this
			// work from touching its bundle.
			const persistedBundle = await dispatch(
				persistBlueprintBundleForSetup({
					slug: site.slug,
					expectedSetup: {
						id: site.metadata.id,
						whenCreated: site.metadata.whenCreated,
						runtimeConfiguration:
							site.metadata.runtimeConfiguration,
						sourceSetupUrlFingerprint:
							site.metadata.sourceSetupUrlFingerprint,
					},
					source: fs.backend,
				})
			);
			if (!persistedBundle) {
				throw new Error(
					'Blueprint filesystem initialization was superseded'
				);
			}
			return getEventedFilesystem(persistedBundle);
		};
		const cachedTemporaryFilesystem =
			!previousFilesystemState &&
			isAutosaved &&
			!isFilesystemBackend(site.metadata.originalBlueprint)
				? getExistingTemporaryBlueprintFilesystem(filesystemIdentity)
				: undefined;
		const filesystemPromise = cachedTemporaryFilesystem
			? cachedTemporaryFilesystem
			: site.metadata.storage === 'none' &&
				  !isFilesystemBackend(site.metadata.originalBlueprint)
				? getStableTemporaryBlueprintFilesystem(
						filesystemIdentity,
						createFilesystem
					)
				: createFilesystem();
		const resolvedLifecycle = cachedTemporaryFilesystem
			? 'temporary'
			: filesystemLifecycle;

		filesystemPromise
			.then((nextFilesystem) => {
				if (!cancelled) {
					setFilesystemState({
						identity: filesystemIdentity,
						lifecycle: resolvedLifecycle,
						filesystem: nextFilesystem,
					});
				}
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}
				logger.error(
					'Failed to initialize Blueprint editor filesystem',
					error
				);
			});
		return () => {
			cancelled = true;
		};
		// Rebuild only for a different site, setup revision, or storage lifecycle.
		// Usage metadata such as `whenLastUsed` must not remount the editor.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		dispatch,
		site.slug,
		filesystemIdentity,
		filesystemLifecycle,
		filesystemState?.identity,
		filesystemState?.lifecycle,
	]);

	useImperativeHandle(
		ref,
		() => ({
			downloadBundle: () =>
				innerEditorRef.current?.downloadBundle() ?? Promise.resolve(),
			getBundle: () =>
				innerEditorRef.current?.getBundle() ?? Promise.resolve(null),
		}),
		[]
	);

	return (
		<div className={classNames(styles.container, className)}>
			{filesystem && (
				<BlueprintBundleEditor
					ref={innerEditorRef}
					filesystem={filesystem}
					site={site}
					className={className}
					readOnly={readOnly || isFilesystemTransition}
				/>
			)}
		</div>
	);
});

/** Keeps the current temporary site's in-memory bundle across manager mounts. */
function getStableTemporaryBlueprintFilesystem(
	identity: string,
	createFilesystem: () => Promise<EventedFilesystem>
) {
	if (temporaryBlueprintFilesystem?.identity === identity) {
		return temporaryBlueprintFilesystem.filesystem;
	}
	const filesystemPromise = createFilesystem();
	// The site slice permits only one temporary Playground. Replacing this slot
	// releases the old in-memory bundle when that Playground is replaced.
	temporaryBlueprintFilesystem = {
		identity,
		filesystem: filesystemPromise,
	};
	void filesystemPromise.catch(() => {
		if (temporaryBlueprintFilesystem?.filesystem === filesystemPromise) {
			temporaryBlueprintFilesystem = undefined;
		}
	});
	return filesystemPromise;
}

/** Returns the current temporary draft when it belongs to this setup revision. */
function getExistingTemporaryBlueprintFilesystem(identity: string) {
	return temporaryBlueprintFilesystem?.identity === identity
		? temporaryBlueprintFilesystem.filesystem
		: undefined;
}

export default SiteBlueprintBundleEditor;
