import { logger } from '@php-wasm/logger';
import { dirname, ensureAbsolutePath } from '@php-wasm/util';
import { Button, Notice } from '@wordpress/components';
import { type Blueprint, BlueprintReflection } from '@wp-playground/blueprints';
import {
	type AsyncWritableFilesystem,
	EventedFilesystem,
	InMemoryFilesystemBackend,
	OpfsFilesystemBackend,
	copyFilesystem,
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
// Reuse the file browser layout styles to keep UI consistent
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

/** Default OPFS path for the last edited blueprint bundle. */
const OPFS_BASE_PATH = 'blueprints/last-edited-bundle';

/** Check if there's a saved blueprint bundle in the default OPFS location. */
async function hasSavedBundle(): Promise<boolean> {
	try {
		const backend = await OpfsFilesystemBackend.fromPath(OPFS_BASE_PATH);
		const files = await backend.listFiles('/');
		return files.length > 0;
	} catch {
		return false;
	}
}

/** Create an OPFS backend for the default blueprint bundle location. */
async function createOpfsBackend(): Promise<OpfsFilesystemBackend> {
	return OpfsFilesystemBackend.fromPath(OPFS_BASE_PATH, true);
}

/**
 * Check if an object implements the FilesystemBackend interface.
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
		for (const path of collectBundledResourcePaths(declaration)) {
			const absolutePath = ensureAbsolutePath(path);
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
	// If originalBlueprint is already a filesystem backend (e.g.,
	// PersistedBlueprintBundle), use it directly instead of populating from
	// Blueprint JSON.
	if (isFilesystemBackend(originalBlueprint)) {
		return new EventedFilesystem(originalBlueprint);
	}

	// Otherwise, populate an in-memory filesystem with the Blueprint JSON.
	const fs = new EventedFilesystem(new InMemoryFilesystemBackend());
	if (originalBlueprint) {
		await populateFilesystemFromBlueprint(
			fs,
			originalBlueprint as Blueprint
		);
	}
	return fs;
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

/**
 * Track which sites have had the autosave prompt answered this session.
 * This prevents asking the user again if they navigate away and return.
 */
const autosavePromptAnswered: Record<string, boolean> = {};

export interface AutosavedBlueprintBundleEditorHandle {
	downloadBundle: () => Promise<void>;
	getBundle: () => Promise<AsyncWritableFilesystem | null>;
}

type AutosavedBlueprintBundleEditorProps = {
	isVisible?: boolean;
	className?: string;
	site: SiteInfo;
};

/**
 * Shell component – handles filesystem acquisition and autosave overlay,
 * then mounts the inner editor with a stable filesystem instance.
 */
export const AutosavedBlueprintBundleEditor = forwardRef<
	AutosavedBlueprintBundleEditorHandle,
	AutosavedBlueprintBundleEditorProps
>(function ({ className, site }, ref) {
	const dispatch = useAppDispatch();
	const [filesystem, setFilesystem] = useState<EventedFilesystem | null>(
		null
	);
	const [autosavePromptVisible, setAutosavePromptVisible] = useState(false);
	const [autosaveErrorMessage, setAutosaveErrorMessage] = useState<
		string | null
	>(null);
	// Track whether we've already migrated to OPFS (to avoid migrating twice)
	const hasMigratedToOpfs = useRef(false);

	const innerEditorRef = useRef<BlueprintBundleEditorHandle | null>(null);

	// Autosaved and explicitly saved Playgrounds both use OPFS, but they
	// represent different lifecycle states. Autosaves are recovery copies that
	// can still be reshaped by editing their Blueprint; explicit saves are
	// user-preserved site artifacts, so their Blueprints remain read-only.
	const isAutosaved = isAutosavedSite(site);
	const readOnly = isExplicitlySavedSite(site);

	// Initialize the filesystem.
	useEffect(() => {
		const bootstrap = async () => {
			if (isAutosaved) {
				// Autosaved Playgrounds are editable. Start from their current
				// Blueprint, which may be either an OPFS bundle backend or a
				// declaration-only Blueprint.
				const fs = await createFilesystemFromOriginalBlueprint(
					site.metadata.originalBlueprint
				);
				if (isFilesystemBackend(site.metadata.originalBlueprint)) {
					setFilesystem(fs);
					return;
				}

				// Declaration-only Blueprints need a persisted bundle before editing
				// so bundled files have a stable OPFS home beside WordPress files.
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
				setFilesystem(opfsFilesystem);
				return;
			}

			// Explicitly saved Playgrounds show the Blueprint as the creation recipe
			// for a preserved site. Editing that recipe without recreating the site
			// would make the saved metadata disagree with the WordPress files.
			if (readOnly) {
				setFilesystem(
					await createFilesystemFromOriginalBlueprint(
						site.metadata.originalBlueprint
					)
				);
				return;
			}

			// Okay, we're dealing with a temporary site where we can edit the Blueprint.

			// Do we have a prior autosave? The user may want to restore it.
			if (await hasSavedBundle()) {
				// We have one! Check if the user has already answered the restore prompt
				// for this site (e.g., they navigated away and came back).
				const alreadyAnswered = autosavePromptAnswered[site.slug];

				// Also check if the current site was loaded from a prior autosave.
				const loadedFromAutosave =
					site.metadata.originalBlueprintSource.type ===
					'last-autosave';

				if (!alreadyAnswered && !loadedFromAutosave) {
					// The current site wasn't loaded from the autosave and the user
					// hasn't answered the prompt yet. Ask them what to do.
					setAutosavePromptVisible(true);
					return;
				}

				// Either the user already answered, or the site was loaded from autosave.
				// Continue editing with OPFS.
				hasMigratedToOpfs.current = true;
				try {
					const fs = new EventedFilesystem(await createOpfsBackend());
					setFilesystem(fs);
					return;
				} catch (error) {
					logger.error(
						'Failed to load autosaved filesystem. Falling back to in-memory.',
						error
					);
				}
			}

			// No autosave exists, or we couldn't load it.
			// Start with an in-memory filesystem. We'll migrate to OPFS on first edit.
			setFilesystem(
				await createFilesystemFromOriginalBlueprint(
					site.metadata.originalBlueprint
				)
			);
		};

		bootstrap();
		// Rebuild the editor filesystem only when it switches to a different site
		// or a different editability mode. Usage metadata such as `whenLastUsed`
		// can change while the user is editing and should not remount the editor.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [site.slug, isAutosaved, readOnly]);

	/**
	 * Discard an autosave: clear OPFS and start fresh with in-memory.
	 * The user discarded their changes, so we don't want to autosave
	 * until they make new changes.
	 */
	const discardAutosave = async () => {
		setAutosaveErrorMessage(null);
		try {
			const opfsBackend = await createOpfsBackend();
			await opfsBackend.clear();

			// Clear the "answered" flag since we're starting fresh.
			// If the user makes changes, they'll create a new autosave,
			// and we shouldn't skip the prompt next time if they reload.
			delete autosavePromptAnswered[site.slug];

			setFilesystem(
				await createFilesystemFromOriginalBlueprint(
					site.metadata.originalBlueprint
				)
			);
			setAutosavePromptVisible(false);
		} catch (error) {
			logger.error('Failed to discard autosave bundle', error);
			setAutosaveErrorMessage(
				'Could not discard the autosave. Please report an issue in the WordPress Playground repository.'
			);
		}
	};

	/**
	 * Restore an autosave: initialize the Blueprint filesystem directly from OPFS.
	 */
	const restoreAutosave = async () => {
		setAutosaveErrorMessage(null);
		try {
			// Remember that the user chose to restore, so we don't ask again
			// if they navigate away and return.
			autosavePromptAnswered[site.slug] = true;

			hasMigratedToOpfs.current = true;
			const fs = new EventedFilesystem(await createOpfsBackend());
			setFilesystem(fs);
			setAutosaveErrorMessage(null);
			setAutosavePromptVisible(false);
		} catch (error) {
			logger.error('Failed to load autosave bundle', error);
			setAutosaveErrorMessage(
				'Could not load the autosaved Blueprint. Please report an issue in the WordPress Playground repository.'
			);
		}
	};

	/**
	 * Migrate from in-memory to OPFS on first user edit of a fresh temporary site's Blueprint.
	 * This ensures autosaves only exist when the user has actually made changes.
	 */
	useEffect(() => {
		if (
			!filesystem ||
			readOnly ||
			isAutosaved ||
			hasMigratedToOpfs.current
		) {
			return;
		}
		async function migrateToOpfs() {
			if (
				hasMigratedToOpfs.current ||
				readOnly ||
				isAutosaved ||
				!filesystem
			) {
				return;
			}
			hasMigratedToOpfs.current = true;

			try {
				// Replace the in-memory filesystem with an OPFS filesystem.
				const opfsBackend = await createOpfsBackend();
				await opfsBackend.clear();
				const opfsFilesystem = new EventedFilesystem(opfsBackend);
				await copyFilesystem(filesystem.backend, opfsBackend);
				setFilesystem(opfsFilesystem);

				// Mark the prompt as answered since the user is now editing
				// their own autosave. They shouldn't be asked again.
				autosavePromptAnswered[site.slug] = true;
			} catch (error) {
				logger.error(
					'Failed to migrate to OPFS for autosave. Continuing with in-memory filesystem.',
					error
				);
			}
		}
		filesystem.addEventListener('change', migrateToOpfs);
		return () => {
			filesystem.removeEventListener('change', migrateToOpfs);
		};
	}, [filesystem, isAutosaved, readOnly, site.slug]);

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

	const overlay = autosavePromptVisible ? (
		<div className={styles.autosaveOverlay} role="dialog" aria-modal="true">
			<div className={styles.autosaveCard}>
				<h3 className={styles.autosaveTitle}>
					Restore last edited blueprint?
				</h3>
				<p className={styles.autosaveMessage}>
					You have an autosaved Blueprint – would you like to continue
					editing it? Or discard it and edit the Blueprint related to
					the currently opened Playground?
				</p>
				{autosaveErrorMessage ? (
					<div className={styles.autosaveError}>
						<Notice status="error" isDismissible={false}>
							{autosaveErrorMessage}
						</Notice>
					</div>
				) : null}
				<div className={styles.autosaveActions}>
					<Button variant="primary" onClick={restoreAutosave}>
						Restore autosave
					</Button>
					<Button variant="tertiary" onClick={discardAutosave}>
						Discard autosave
					</Button>
				</div>
			</div>
		</div>
	) : null;

	return (
		<div className={classNames(styles.container, className)}>
			{!autosavePromptVisible && filesystem && (
				<BlueprintBundleEditor
					ref={innerEditorRef}
					filesystem={filesystem}
					site={site}
					className={className}
					readOnly={readOnly}
				/>
			)}
			{overlay}
		</div>
	);
});

export default AutosavedBlueprintBundleEditor;
