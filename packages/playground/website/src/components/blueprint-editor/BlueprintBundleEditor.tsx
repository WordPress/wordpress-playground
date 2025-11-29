import { autocompletion } from '@codemirror/autocomplete';
import { logger } from '@php-wasm/logger';
import { Button, Icon, Notice } from '@wordpress/components';
import { download } from '@wordpress/icons';
import { resolveRuntimeConfiguration } from '@wp-playground/blueprints';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { BlobWriter, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js';
import classNames from 'classnames';
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	CodeEditor,
	type CodeEditorHandle,
} from '../site-manager/site-file-browser/code-editor';
import { FileExplorerSidebar } from './file-explorer-sidebar';
import { jsonSchemaCompletion } from './json-schema-editor/jsonSchemaCompletion';
// Reuse the file browser layout styles to keep UI consistent
import { useDebouncedCallback } from '../../lib/hooks/use-debounced-callback';
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import { sitesSlice } from '../../lib/state/redux/slice-sites';
import { useAppDispatch } from '../../lib/state/redux/store';
import styles from '../site-manager/site-file-browser/style.module.css';
import hideRootStyles from './hide-root.module.css';
import type { EventedFilesystem } from '@wp-playground/storage';

const BLUEPRINT_JSON_PATH = '/blueprint.json';

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
export type BlueprintBundleEditorProps = {
	filesystem: AsyncWritableFilesystem;
	className?: string;
	site?: SiteInfo;
	autoRunToken?: number;
	readOnly?: boolean;
};

export interface BlueprintBundleEditorHandle {
	downloadBundle: () => Promise<void>;
	getBundle: () => Promise<AsyncWritableFilesystem | null>;
	triggerRecreate: () => Promise<void>;
}

export const BlueprintBundleEditor = forwardRef<
	BlueprintBundleEditorHandle,
	BlueprintBundleEditorProps
>(function BlueprintFilesystemEditor(
	{ filesystem, className, site, autoRunToken, readOnly },
	ref
) {
	const [selectedDirPath, setSelectedDirPath] = useState<string | null>('/');
	const [currentPath, setCurrentPath] = useState<string | null>(null);
	const [code, setCode] = useState<string>('');
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
		200,
		[filesystem]
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
		if (!site || site.metadata.storage !== 'none' || readOnly) {
			return;
		}
		try {
			setIsRecreating(true);
			const bundle =
				(filesystem as EventedFilesystem | null) ??
				((site.metadata.originalBlueprint ||
					null) as EventedFilesystem | null);
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
							originalBlueprintSource: { type: 'last-autosave' },
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
						const file = await filesystem.read(absPath);
						const buffer = new Uint8Array(await file.arrayBuffer());
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

	const disableRunButton = isRecreating || !site;
	return (
		<div className={classNames(styles.container, className)}>
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
						readOnly={readOnly}
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

						<div className={styles.editorHeaderActions}>
							<Button
								variant="tertiary"
								className={styles.editorToolbarButton}
								onClick={handleDownloadBundle}
								title="Download bundle"
							>
								<Icon icon={download} />
							</Button>
							{!readOnly && (
								<Button
									variant="primary"
									className={styles.editorToolbarButton}
									onClick={handleRecreateFromBlueprint}
									isBusy={isRecreating}
									disabled={disableRunButton}
								>
									<PlayIcon
										className={styles.editorToolbarPlayIcon}
									/>
									Run Blueprint
								</Button>
							)}
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
