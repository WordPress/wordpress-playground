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
import { WritableFilesystem } from './writable-filesystem';
import { InMemoryFilesystemBackend } from './writable-in-memory-filesystem';
import { OpfsFilesystemBackend } from './writable-opfs-filesystem';

export const BLUEPRINT_JSON_PATH = '/blueprint.json';

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

	const innerEditorRef = useRef<BlueprintBundleEditorHandle | null>(null);

	// On stored sites, we can only view the Blueprint without editing (or autosaving) it.
	// Let's just populate an in-memory filesystem with the Blueprint.
	const readOnly = site?.metadata.storage !== 'none';

	// Display the "restore autosave" prompt:
	useEffect(() => {
		const bootstrap = async () => {
			let fs: WritableFilesystem | null = null;
			// On stored sites, we can only view the Blueprint without editing (or autosaving) it.
			// Let's just populate an in-memory filesystem with the Blueprint.
			if (readOnly) {
				fs = new WritableFilesystem(new InMemoryFilesystemBackend());
				await fs.populateFromBlueprint(
					site.metadata.originalBlueprint as Blueprint
				);
				setFilesystem(fs);
				return;
			}

			// Okay, we're dealing with a temporary site where we can edit the Blueprint.

			// Do we have a prior autosave? The user may want to restore it.
			if (await OpfsFilesystemBackend.hasSavedBundle()) {
				// We have one! Before we ask the user if they want to restore the autosave, let's
				// check if we already did – perhaps the current site's Blueprint was already loaded
				// from a prior autosave.
				if (
					site.metadata.originalBlueprintSource.type !==
					'local-editor'
				) {
					// No, it wasn't. It's unclear if we should edit the current site's Blueprint
					// or a prior autosave. Let's ask the user.
					// @TODO: Uncomment this and support autosaves. This will require more
					//        planning than initially anticipated. E.g. an autosave should only
					//        be created after the user changes something (at the moment it's
					//        created when the temporary blueprint is initialized).
					// setAutosavePromptVisible(true);
					// return;
				}
			}

			// We're going to edit the Blueprint – let's create a persistent filesystem
			// and autosave the user's progress.
			try {
				fs = new WritableFilesystem(
					await OpfsFilesystemBackend.create()
				);
				setFilesystem(fs);
			} catch (error) {
				// No OPFS access. Let's fall back to an in-memory filesystem.
				logger.error(
					'Failed to initialize blueprint filesystem with OPFS. Falling back to in-memory filesystem.',
					error
				);
				fs = new WritableFilesystem(new InMemoryFilesystemBackend());
				setFilesystem(fs);
			}
		};

		bootstrap();
	}, []);

	const restoreAutosave = async () => {
		setAutosaveErrorMessage(null);
		try {
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

	const discardAutosave = async () => {
		setAutosaveErrorMessage(null);
		try {
			const fs = new WritableFilesystem(
				await OpfsFilesystemBackend.create()
			);
			await fs.clear();
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
					initialFilesystem={filesystem}
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
