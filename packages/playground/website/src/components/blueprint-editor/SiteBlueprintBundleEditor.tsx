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
	loadPersistedBlueprintBundle,
	persistBlueprintBundle,
} from '../../lib/state/opfs/opfs-blueprint-bundle-storage';
import {
	isAutosavedSite,
	isExplicitlySavedSite,
	type SiteInfo,
	updateSite,
} from '../../lib/state/redux/slice-sites';
import { useAppDispatch } from '../../lib/state/redux/store';
import styles from './blueprint-bundle-editor.module.css';
import {
	type BlueprintBundleEditorHandle,
	BlueprintBundleEditor,
} from './BlueprintBundleEditor';

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
 * A minimal valid Blueprint. Every Playground starts from some Blueprint, so the
 * editor should never open empty — when a site has no Blueprint on record we seed
 * this stub so there is always a `blueprint.json` to view and edit.
 */
const STUB_BLUEPRINT_JSON = `${JSON.stringify(
	{
		$schema: 'https://playground.wordpress.net/blueprint-schema.json',
		steps: [],
	},
	null,
	2
)}\n`;

/**
 * Reads a site's `blueprint.json` as text without changing its stored bundle.
 * Used to seed compact Blueprint authoring surfaces.
 */
export async function readSiteBlueprintJson(
	originalBlueprint: SiteInfo['metadata']['originalBlueprint']
): Promise<string> {
	const fs = await createFilesystemFromOriginalBlueprint(originalBlueprint, {
		seedMissingBlueprintJson: !isFilesystemBackend(originalBlueprint),
	});
	return fs.readFileAsText('/blueprint.json');
}

/**
 * Returns an editable filesystem for a site's Blueprint declaration or bundle.
 *
 * Bundle backends can be used directly. Declaration-only Blueprints are copied
 * into a fresh in-memory filesystem so the editor always works with files.
 * Editable filesystems get a stub `blueprint.json` when needed; read-only
 * callers can leave a persisted bundle untouched instead.
 */
async function createFilesystemFromOriginalBlueprint(
	originalBlueprint: SiteInfo['metadata']['originalBlueprint'],
	options: {
		/**
		 * Whether a filesystem-backed bundle may be seeded with a missing
		 * `blueprint.json`. Read-only callers leave persisted bundles untouched.
		 */
		seedMissingBlueprintJson?: boolean;
	} = {}
): Promise<EventedFilesystem> {
	const { seedMissingBlueprintJson = true } = options;
	// If originalBlueprint is already a filesystem backend (e.g.,
	// PersistedBlueprintBundle), use it directly instead of populating from
	// Blueprint JSON.
	if (isFilesystemBackend(originalBlueprint)) {
		const fs = new EventedFilesystem(originalBlueprint);
		if (seedMissingBlueprintJson) {
			await ensureBlueprintJson(fs);
		}
		return fs;
	}

	// Otherwise, populate an in-memory filesystem with the Blueprint JSON.
	const fs = new EventedFilesystem(new InMemoryFilesystemBackend());
	if (originalBlueprint) {
		await populateFilesystemFromBlueprint(
			fs,
			originalBlueprint as Blueprint
		);
	}
	await ensureBlueprintJson(fs);
	return fs;
}

/**
 * Guarantees the editor always has a `blueprint.json` to show. A bundle (or a
 * declaration-only Blueprint) that somehow carries none would otherwise render
 * the editor empty.
 */
async function ensureBlueprintJson(fs: EventedFilesystem): Promise<void> {
	if (!(await fs.fileExists('/blueprint.json'))) {
		await fs.writeFile('/blueprint.json', STUB_BLUEPRINT_JSON);
	}
}

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
	getBundle: () => Promise<AsyncWritableFilesystem | null>;
}

type SiteBlueprintBundleEditorProps = {
	className?: string;
	site: SiteInfo;
	dockPresentation?: boolean;
};

/**
 * Shell component – handles filesystem acquisition, then mounts the inner
 * editor with a stable filesystem instance.
 */
export const SiteBlueprintBundleEditor = forwardRef<
	SiteBlueprintBundleEditorHandle,
	SiteBlueprintBundleEditorProps
>(function SiteBlueprintBundleEditor(
	{ className, site, dockPresentation = false },
	ref
) {
	const dispatch = useAppDispatch();
	const [filesystem, setFilesystem] = useState<EventedFilesystem | null>(
		null
	);

	const innerEditorRef = useRef<BlueprintBundleEditorHandle | null>(null);

	// Autosaved and explicitly saved Playgrounds both use OPFS, but they
	// represent different lifecycle states. Autosaves are recovery copies that
	// can still be reshaped by editing their Blueprint; explicit saves are
	// user-preserved site artifacts, so their Blueprints remain read-only.
	const isAutosaved = isAutosavedSite(site);
	const readOnly = isExplicitlySavedSite(site);

	useEffect(() => {
		let cancelled = false;
		const setFilesystemIfMounted = (fs: EventedFilesystem) => {
			if (!cancelled) {
				setFilesystem(fs);
			}
		};

		const bootstrap = async () => {
			if (isAutosaved) {
				const fs = await createFilesystemFromOriginalBlueprint(
					site.metadata.originalBlueprint
				);
				if (isFilesystemBackend(site.metadata.originalBlueprint)) {
					setFilesystemIfMounted(fs);
					return;
				}

				// Autosaved Playgrounds keep editable Blueprint bundles beside their
				// WordPress files. Declaration-only metadata is converted once into a
				// per-site OPFS bundle so later edits cannot leak into another site.
				await persistBlueprintBundle(site.slug, fs.backend);
				const opfsFilesystem = new EventedFilesystem(
					await loadPersistedBlueprintBundle(site.slug)
				);
				await dispatch(
					updateSite({
						slug: site.slug,
						changes: {
							metadata: {
								...site.metadata,
								originalBlueprint: opfsFilesystem.backend,
								originalBlueprintSource: {
									type: 'opfs-site',
								},
							},
						},
					})
				);
				setFilesystemIfMounted(opfsFilesystem);
				return;
			}

			setFilesystemIfMounted(
				await createFilesystemFromOriginalBlueprint(
					site.metadata.originalBlueprint,
					{
						seedMissingBlueprintJson:
							!readOnly ||
							!isFilesystemBackend(
								site.metadata.originalBlueprint
							),
					}
				)
			);
		};

		bootstrap().catch((error) => {
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
		// Rebuild the editor filesystem only when it switches to a different site
		// or between regular and autosaved site lifecycles. Usage metadata such as
		// `whenLastUsed` can change while the user is editing and should not
		// remount the editor.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dispatch, site.slug, isAutosaved]);

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
					readOnly={readOnly}
					dockPresentation={dockPresentation}
				/>
			)}
		</div>
	);
});

export default SiteBlueprintBundleEditor;
