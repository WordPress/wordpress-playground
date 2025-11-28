import { logger } from '@php-wasm/logger';
import { Button, Notice } from '@wordpress/components';
import {
	type Blueprint,
	type BlueprintBundle,
} from '@wp-playground/blueprints';
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
import { convertBlueprintToWritableFilesystem } from './convert-blueprint-to-filesystem';
import { WritableFilesystem as WritableFilesystemClass } from './writable-filesystem';
import { OpfsFilesystemBackend } from './writable-opfs-filesystem';
import {
	type BlueprintBundleEditorHandle,
	BlueprintBundleEditor,
} from './BlueprintBundleEditor';

export const BLUEPRINT_JSON_PATH = '/blueprint.json';

export interface AutosavedBlueprintBundleEditorHandle {
	downloadBundle: () => Promise<void>;
	getBundle: () => Promise<AsyncWritableFilesystem | null>;
}

type AutosavedBlueprintBundleEditorProps = {
	initialBlueprint: Blueprint;
	isVisible?: boolean;
	onChange?: (blueprint: BlueprintBundle) => void;
	className?: string;
	site?: SiteInfo;
};

/**
 * Shell component – handles filesystem acquisition and autosave overlay,
 * then mounts the inner editor with a stable filesystem instance.
 */
export const AutosavedBlueprintBundleEditor = forwardRef<
	AutosavedBlueprintBundleEditorHandle,
	AutosavedBlueprintBundleEditorProps
>(function ({ initialBlueprint, onChange, className, site }, ref) {
	const [filesystem, setFilesystem] =
		useState<AsyncWritableFilesystem | null>(null);
	const [autosavePromptVisible, setAutosavePromptVisible] = useState(false);
	const [autosaveErrorMessage, setAutosaveErrorMessage] = useState<
		string | null
	>(null);

	const innerEditorRef = useRef<BlueprintBundleEditorHandle | null>(null);

	// Display the "restore autosave" prompt:
	useEffect(() => {
		const bootstrap = async () => {
			// @TODO: Configure via props
			if (
				// isTemporarySite &&
				window.location.hash !== '#local-blueprint-bundle' &&
				(await OpfsFilesystemBackend.hasSavedBundle())
			) {
				setAutosavePromptVisible(true);
				return;
			}

			// Otherwise, initialize the filesystem from the initial blueprint:
			try {
				const fs =
					await convertBlueprintToWritableFilesystem(
						initialBlueprint
					);
				fs.addEventListener('change', () => {
					onChange?.(fs as any);
				});
				setFilesystem(fs);
			} catch (error) {
				// @TODO: What now?
				logger.error(
					'Failed to initialize blueprint filesystem',
					error
				);
			}
		};

		bootstrap();
	}, []);

	const restoreAutosave = async () => {
		setAutosaveErrorMessage(null);
		try {
			const fs = new WritableFilesystemClass(
				await OpfsFilesystemBackend.loadFromOpfs()
			);
			fs.addEventListener('change', () => {
				onChange?.(fs as any);
			});
			setFilesystem(fs);
			setAutosaveErrorMessage(null);
			// @TODO: Should this component be concerned with the URL hash?
			window.location.hash = '#local-blueprint-bundle';
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
			await OpfsFilesystemBackend.discardSavedBundle();
			const fs =
				await convertBlueprintToWritableFilesystem(initialBlueprint);
			fs.addEventListener('change', () => {
				onChange?.(fs as any);
			});
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
				/>
			)}
			{overlay}
		</div>
	);
});

export default AutosavedBlueprintBundleEditor;
