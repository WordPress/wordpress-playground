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
// Reuse the file browser layout styles to keep UI consistent
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import styles from '../site-manager/site-file-browser/style.module.css';
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
		'fileExists' in obj
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

	// On stored sites, we can only view the Blueprint without editing (or autosaving) it.
	// Let's just populate an in-memory filesystem with the Blueprint.
	const readOnly = site?.metadata.storage !== 'none';

	// Initialize the filesystem.
	useEffect(() => {
		const bootstrap = async () => {
			let fs: EventedFilesystem | null = null;
			// On stored sites, we can only view the Blueprint without editing (or autosaving) it.
			if (readOnly) {
				const originalBlueprint = site.metadata.originalBlueprint;

				// If originalBlueprint is already a filesystem backend (e.g., PersistedBlueprintBundle),
				// use it directly instead of populating from blueprint JSON.
				if (isFilesystemBackend(originalBlueprint)) {
					fs = new EventedFilesystem(originalBlueprint);
					setFilesystem(fs);
					return;
				}

				// Otherwise, populate an in-memory filesystem with the Blueprint JSON.
				fs = new EventedFilesystem(new InMemoryFilesystemBackend());
				if (originalBlueprint) {
					await populateFilesystemFromBlueprint(
						fs,
						originalBlueprint as Blueprint
					);
				}
				setFilesystem(fs);
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
					fs = new EventedFilesystem(await createOpfsBackend());
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
			fs = new EventedFilesystem(new InMemoryFilesystemBackend());
			await populateFilesystemFromBlueprint(
				fs,
				site.metadata.originalBlueprint as Blueprint
			);
			setFilesystem(fs);
		};

		bootstrap();
	}, []);

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

			const fs = new EventedFilesystem(new InMemoryFilesystemBackend());
			await populateFilesystemFromBlueprint(
				fs,
				site.metadata.originalBlueprint as Blueprint
			);
			setFilesystem(fs);
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
		if (!filesystem || readOnly || hasMigratedToOpfs.current) {
			return;
		}
		async function migrateToOpfs() {
			if (hasMigratedToOpfs.current || readOnly || !filesystem) {
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
	}, [filesystem, readOnly, site.slug]);

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
