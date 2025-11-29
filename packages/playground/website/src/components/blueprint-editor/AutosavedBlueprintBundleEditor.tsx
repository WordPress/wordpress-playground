import { logger } from '@php-wasm/logger';
import { Button, Notice } from '@wordpress/components';
import { type Blueprint } from '@wp-playground/blueprints';
import type { AsyncWritableFilesystem } from '@wp-playground/components';
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
import {
	type WritableFilesystemBackend,
	WritableFilesystem,
} from './writable-filesystem';
import { InMemoryFilesystemBackend } from './writable-in-memory-filesystem';
import { OpfsFilesystemBackend } from './writable-opfs-filesystem';

/**
 * Check if an object implements the FilesystemBackend interface.
 */
function isFilesystemBackend(obj: unknown): obj is WritableFilesystemBackend {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'listFiles' in obj &&
		'isDir' in obj &&
		'readFileAsBuffer' in obj &&
		'fileExists' in obj
	);
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
	const [filesystem, setFilesystem] = useState<WritableFilesystem | null>(
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
			let fs: WritableFilesystem | null = null;
			// On stored sites, we can only view the Blueprint without editing (or autosaving) it.
			if (readOnly) {
				const originalBlueprint = site.metadata.originalBlueprint;

				// If originalBlueprint is already a filesystem backend (e.g., PersistedBlueprintBundle),
				// use it directly instead of populating from blueprint JSON.
				if (isFilesystemBackend(originalBlueprint)) {
					fs = new WritableFilesystem(originalBlueprint);
					setFilesystem(fs);
					return;
				}

				// Otherwise, populate an in-memory filesystem with the Blueprint JSON.
				fs = new WritableFilesystem(new InMemoryFilesystemBackend());
				await fs.populateFromBlueprint(originalBlueprint as Blueprint);
				setFilesystem(fs);
				return;
			}

			// Okay, we're dealing with a temporary site where we can edit the Blueprint.

			// Do we have a prior autosave? The user may want to restore it.
			if (await OpfsFilesystemBackend.hasSavedBundle()) {
				// We have one! Check if the user has already answered the restore prompt
				// for this site (e.g., they navigated away and came back).
				const alreadyAnswered = autosavePromptAnswered[site.slug];

				// Also check if the current site was loaded from a prior autosave.
				const loadedFromAutosave =
					site.metadata.originalBlueprintSource.type ===
					'local-editor';

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
					fs = new WritableFilesystem(
						await OpfsFilesystemBackend.create()
					);
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
			fs = new WritableFilesystem(new InMemoryFilesystemBackend());
			await fs.populateFromBlueprint(
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
			const opfsBackend = await OpfsFilesystemBackend.create();
			await opfsBackend.clear();

			// Clear the "answered" flag since we're starting fresh.
			// If the user makes changes, they'll create a new autosave,
			// and we shouldn't skip the prompt next time if they reload.
			delete autosavePromptAnswered[site.slug];

			const fs = new WritableFilesystem(new InMemoryFilesystemBackend());
			await fs.populateFromBlueprint(
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
			const fs = new WritableFilesystem(
				await OpfsFilesystemBackend.create()
			);
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
				const opfsBackend = await OpfsFilesystemBackend.create();
				await opfsBackend.clear();
				const opfsFilesystem = new WritableFilesystem(opfsBackend);
				await copyFilesystem(filesystem, opfsFilesystem);
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

/**
 * Copies all files and directories from source filesystem to destination.
 */
async function copyFilesystem(
	source: WritableFilesystem,
	destination: WritableFilesystem
): Promise<void> {
	const copyDir = async (path: string) => {
		const entries = await source.listFiles(path);
		for (const name of entries) {
			const fullPath = path === '/' ? `/${name}` : `${path}/${name}`;
			if (await source.isDir(fullPath)) {
				await destination.mkdir(fullPath);
				await copyDir(fullPath);
			} else {
				const content = await source.readFileAsBuffer(fullPath);
				await destination.writeFile(fullPath, content);
			}
		}
	};
	await copyDir('/');
}
