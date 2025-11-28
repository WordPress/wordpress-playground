import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react';
import classNames from 'classnames';
import { Button, Notice, Icon } from '@wordpress/components';
import { download } from '@wordpress/icons';
import type { AsyncWritableFilesystem } from '@wp-playground/components';
import {
	type Blueprint,
	type BlueprintBundle,
	resolveRuntimeConfiguration,
} from '@wp-playground/blueprints';
import { logger } from '@php-wasm/logger';
import { autocompletion } from '@codemirror/autocomplete';
import { ZipWriter, BlobWriter, Uint8ArrayReader } from '@zip.js/zip.js';
import { FileExplorerSidebar } from './file-explorer-sidebar';
import { jsonSchemaCompletion } from './json-schema-editor';
import {
	CodeEditor,
	type CodeEditorHandle,
} from '../site-manager/site-file-browser/code-editor';
// Reuse the file browser layout styles to keep UI consistent
import styles from '../site-manager/site-file-browser/style.module.css';
import { convertBlueprintToWritableFilesystem } from './convert-blueprint-to-filesystem';
import hideRootStyles from './hide-root.module.css';
import type { WritableInMemoryFilesystem } from './writable-in-memory-filesystem';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import { sitesSlice } from '../../lib/state/redux/slice-sites';
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import { useAppDispatch } from '../../lib/state/redux/store';
import { WritableOpfsFilesystem } from './writable-opfs-filesystem';
import { useDebouncedCallback } from '../../lib/hooks/use-debounced-callback';

export const BLUEPRINT_JSON_PATH = '/blueprint.json';

export interface BlueprintBundleEditorHandle {
	downloadBundle: () => Promise<void>;
	getBundle: () => Promise<AsyncWritableFilesystem | null>;
}

type BlueprintBundleEditorProps = {
	initialBlueprint: Blueprint;
	isVisible?: boolean;
	onChange?: (blueprint: BlueprintBundle) => void;
	className?: string;
	site?: SiteInfo;
};

const PlayIcon = ({ className }: { className?: string }) => (
	<svg
		className={className}
		viewBox="0 0 32 32"
		width="18"
		height="18"
		aria-hidden="true"
	>
		<circle
			cx="16"
			cy="16"
			r="12"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		/>
		<path
			d="M13 11v10l8-5-8-5z"
			fill="currentColor"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinejoin="round"
		/>
	</svg>
);

/**
 * Inner editor that assumes the filesystem never changes.
 */
type BlueprintFilesystemEditorProps = {
	initialFilesystem: AsyncWritableFilesystem;
	className?: string;
	site?: SiteInfo;
	autoRunToken?: number;
};

export interface BlueprintFilesystemEditorHandle {
	downloadBundle: () => Promise<void>;
	getBundle: () => Promise<AsyncWritableFilesystem | null>;
	triggerRecreate: () => Promise<void>;
}

const BlueprintFilesystemEditor = forwardRef<
	BlueprintFilesystemEditorHandle,
	BlueprintFilesystemEditorProps
>(function BlueprintFilesystemEditor(
	{ initialFilesystem: filesystem, className, site, autoRunToken },
	ref
) {
	const [selectedDirPath, setSelectedDirPath] = useState<string | null>('/');
	const [currentPath, setCurrentPath] = useState<string | null>(null);
	const [code, setCode] = useState<string>('');
	const [readOnly, setReadOnly] = useState<boolean>(true);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [showExplorerOnMobile, setShowExplorerOnMobile] =
		useState<boolean>(false);
	const [treeFocusPath, setTreeFocusPath] = useState<string | null>(null);
	const [messageContent, setMessageContent] = useState<
		string | JSX.Element | null
	>(null);
	const [displayPath, setDisplayPath] = useState<string | null>(null);
	const [isRecreating, setIsRecreating] = useState(false);

	const editorRef = useRef<CodeEditorHandle | null>(null);
	const dispatch = useAppDispatch();

	// Save file to filesystem
	const saveFile = useDebouncedCallback(
		async (path: string, content: string) => {
			try {
				await filesystem.writeFile(path, content);
				setSaveError(null);
			} catch (error) {
				logger.error('Failed to save file', error);
				setSaveError('Could not save changes. Try again.');
			}
		},
		200
	);

	const handleCodeChange = useCallback(
		(newCode: string) => {
			setCode(newCode);
			if (currentPath) {
				saveFile(currentPath, newCode);
			}
		},
		[currentPath, saveFile]
	);

	// Load initial blueprint.json and focus tree
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const blueprintJsonContent =
					await filesystem.readFileAsText(BLUEPRINT_JSON_PATH);
				if (cancelled) return;
				setCurrentPath(BLUEPRINT_JSON_PATH);
				setDisplayPath(BLUEPRINT_JSON_PATH);
				setCode(blueprintJsonContent);
				setReadOnly(false);
				setSaveError(null);
				setMessageContent(null);
				setShowExplorerOnMobile(false);
				setTreeFocusPath(BLUEPRINT_JSON_PATH);
			} catch (error) {
				logger.error('Could not open blueprint.json', error);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [filesystem]);

	const handleRecreateFromBlueprint = useCallback(async () => {
		if (!site || site.metadata.storage !== 'none') {
			return;
		}
		try {
			setIsRecreating(true);
			const bundle =
				(filesystem as WritableInMemoryFilesystem | null) ??
				((site.metadata.originalBlueprint ||
					null) as WritableInMemoryFilesystem | null);
			if (!bundle) {
				throw new Error('Blueprint bundle is not available.');
			}
			const runtimeConfiguration = await resolveRuntimeConfiguration(
				bundle as any
			);
			dispatch(removeClientInfo(site.slug));
			dispatch(
				sitesSlice.actions.updateSite({
					id: site.slug,
					changes: {
						metadata: {
							...site.metadata,
							originalBlueprintSource: { type: 'local-editor' },
							originalBlueprint: bundle,
							runtimeConfiguration,
							whenCreated: Date.now(),
						},
						originalUrlParams: undefined,
					},
				})
			);
		} catch (error) {
			logger.error('Failed to recreate from blueprint', error);
			setSaveError('Could not recreate Playground. Try again.');
		} finally {
			setIsRecreating(false);
		}
	}, [dispatch, filesystem, site]);

	// autorun token hook
	useEffect(() => {
		if (autoRunToken === undefined) return;
		void handleRecreateFromBlueprint();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoRunToken]);

	const handleFileOpened = useCallback(
		(path: string, content: string, shouldFocus = true) => {
			setCurrentPath(path);
			setCode(content);
			setDisplayPath(path);
			setMessageContent(null);
			setReadOnly(false);
			setSaveError(null);
			setShowExplorerOnMobile(false);
			setTreeFocusPath(path);

			if (shouldFocus) {
				setTimeout(() => editorRef.current?.focus(), 20);
			}
		},
		[]
	);

	const handleClearSelection = useCallback(() => {
		setCurrentPath(null);
		setCode('');
		setMessageContent(null);
		setDisplayPath(null);
		setReadOnly(true);
		setSaveError(null);
		setTreeFocusPath(null);
	}, []);

	const handleShowMessage = useCallback(
		(path: string | null, message: string | JSX.Element) => {
			setCurrentPath(null);
			setDisplayPath((prev) => path ?? prev);

			if (typeof message === 'string') {
				setCode(message);
				setMessageContent(null);
			} else {
				setCode('');
				setMessageContent(message);
			}

			setReadOnly(true);
			setSaveError(null);
			setShowExplorerOnMobile(false);
			setTreeFocusPath(null);
		},
		[]
	);

	const blueprintSchemaExtensions = useMemo(
		() => [
			autocompletion({
				override: [jsonSchemaCompletion],
				activateOnTyping: true,
				closeOnBlur: false,
			}),
		],
		[]
	);

	const handleDownloadBundle = useCallback(async () => {
		try {
			const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
			const addEntries = async (dirPath: string, prefix: string) => {
				const entries = await filesystem.listFiles(dirPath);
				for (const name of entries) {
					const absPath =
						dirPath === '/' ? `/${name}` : `${dirPath}/${name}`;
					const relative = prefix ? `${prefix}${name}` : name;
					if (await filesystem.isDir(absPath)) {
						await addEntries(
							absPath,
							relative.length ? `${relative}/` : ''
						);
					} else {
						const buffer =
							await filesystem.readFileAsBuffer(absPath);
						await zipWriter.add(
							relative || name,
							new Uint8ArrayReader(buffer)
						);
					}
				}
			};
			await addEntries('/', '');
			const blob = await zipWriter.close();
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = 'blueprint-bundle.zip';
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			setTimeout(() => URL.revokeObjectURL(url), 60_000);
		} catch (error) {
			logger.error('Failed to download bundle', error);
			setSaveError('Could not download bundle. Try again.');
		}
	}, [filesystem]);

	useImperativeHandle(
		ref,
		() => ({
			downloadBundle: handleDownloadBundle,
			getBundle: async () => filesystem,
			triggerRecreate: handleRecreateFromBlueprint,
		}),
		[handleDownloadBundle, filesystem, handleRecreateFromBlueprint]
	);

	const isTemporarySite = site?.metadata.storage === 'none';
	const showToolbar = Boolean(isTemporarySite);
	const disableRunButton = !isTemporarySite || isRecreating || !site;
	const showDownloadButton = Boolean(isTemporarySite);

	return (
		<div className={classNames(styles.container, className)}>
			{showToolbar && (
				<div className={styles.editorToolbar}>
					{showDownloadButton ? (
						<Button
							variant="link"
							className={styles.editorToolbarButton}
							onClick={handleDownloadBundle}
						>
							<Icon icon={download} />
						</Button>
					) : null}
					<Button
						variant="primary"
						className={styles.editorToolbarButton}
						onClick={handleRecreateFromBlueprint}
						isBusy={isRecreating}
						disabled={disableRunButton}
					>
						<PlayIcon className={styles.editorToolbarPlayIcon} />
						Run
					</Button>
				</div>
			)}
			<div
				className={classNames(styles.content, {
					[styles.sidebarOpen]: showExplorerOnMobile,
				})}
			>
				<div
					className={styles.mobileOverlay}
					onClick={() => setShowExplorerOnMobile(false)}
				/>
				<aside
					className={classNames(
						styles.sidebarWrapper,
						hideRootStyles.hideRoot
					)}
				>
					<FileExplorerSidebar
						filesystem={filesystem}
						currentPath={currentPath}
						selectedDirPath={selectedDirPath}
						setSelectedDirPath={setSelectedDirPath}
						focusPath={treeFocusPath}
						onFileOpened={handleFileOpened}
						onSelectionCleared={handleClearSelection}
						onShowMessage={handleShowMessage}
						documentRoot="/"
					/>
				</aside>
				<section className={styles.editorWrapper}>
					<div className={styles.editorHeader}>
						<Button
							className={styles.mobileToggle}
							variant="secondary"
							onClick={() =>
								setShowExplorerOnMobile((previous) => !previous)
							}
						>
							{showExplorerOnMobile
								? 'Hide files'
								: 'Browse files'}
						</Button>
						<div
							className={classNames(styles.editorPath, {
								[styles.editorPathPlaceholder]:
									!currentPath?.length,
							})}
						>
							{displayPath ||
								selectedDirPath ||
								'Browse files under /'}
						</div>
					</div>
					{saveError ? (
						<div style={{ padding: '8px 16px' }}>
							<Notice status="error" isDismissible={false}>
								{saveError}
							</Notice>
						</div>
					) : null}
					{currentPath || code || messageContent ? (
						messageContent ? (
							<div className={styles.messageArea}>
								{messageContent}
							</div>
						) : (
							<CodeEditor
								ref={editorRef}
								code={code}
								onChange={handleCodeChange}
								currentPath={currentPath}
								className={styles.editor}
								readOnly={readOnly}
								additionalExtensions={
									currentPath === BLUEPRINT_JSON_PATH
										? blueprintSchemaExtensions
										: undefined
								}
							/>
						)
					) : (
						<div className={styles.placeholder}>
							Select a file to view or edit its contents.
						</div>
					)}
				</section>
			</div>
		</div>
	);
});

/**
 * Shell component – handles filesystem acquisition and autosave overlay,
 * then mounts the inner editor with a stable filesystem instance.
 */
export const BlueprintBundleEditor = forwardRef<
	BlueprintBundleEditorHandle,
	BlueprintBundleEditorProps
>(function BlueprintBundleEditor(
	{ initialBlueprint, onChange, className, site },
	ref
) {
	const [filesystem, setFilesystem] =
		useState<AsyncWritableFilesystem | null>(null);
	const [autosavePromptVisible, setAutosavePromptVisible] = useState(false);
	const [autosaveErrorMessage, setAutosaveErrorMessage] = useState<
		string | null
	>(null);

	const innerEditorRef = useRef<BlueprintFilesystemEditorHandle | null>(null);

	// Display the "restore autosave" prompt:
	useEffect(() => {
		const bootstrap = async () => {
			// @TODO: Configure via props
			if (
				// isTemporarySite &&
				window.location.hash !== '#local-blueprint-bundle' &&
				(await WritableOpfsFilesystem.hasSavedBundle())
			) {
				setAutosavePromptVisible(true);
				return;
			}

			// Otherwise, initialize the filesystem from the initial blueprint:
			try {
				const fs = await convertBlueprintToWritableFilesystem(
					initialBlueprint,
					{ persistToOpfs: true }
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
			const fs = await WritableOpfsFilesystem.loadFromOpfs();
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
			await WritableOpfsFilesystem.discardSavedBundle();
			const fs = await convertBlueprintToWritableFilesystem(
				initialBlueprint,
				{
					persistToOpfs: true,
				}
			);
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
				<BlueprintFilesystemEditor
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

export default BlueprintBundleEditor;
