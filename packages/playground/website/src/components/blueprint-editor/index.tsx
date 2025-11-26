import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { Button, Notice } from '@wordpress/components';
import type { AsyncWritableFilesystem } from '@wp-playground/components';
import type { Blueprint, BlueprintBundle } from '@wp-playground/blueprints';
import { logger } from '@php-wasm/logger';
import { autocompletion } from '@codemirror/autocomplete';
import { FileExplorerSidebar } from './file-explorer-sidebar';
import { jsonSchemaCompletion } from './json-schema-editor';
import {
	CodeEditor,
	type CodeEditorHandle,
} from '../site-manager/site-file-browser/code-editor';
// Reuse the file browser layout styles to keep UI consistent
import styles from '../site-manager/site-file-browser/style.module.css';
import { SaveState } from './save-state';
import { convertBlueprintToWritableFilesystem } from './convert-blueprint-to-filesystem';
import hideRootStyles from './hide-root.module.css';

export const SAVE_DEBOUNCE_MS = 100;
export const BLUEPRINT_JSON_PATH = '/blueprint.json';

export function BlueprintBundleEditor({
	initialBlueprint,
	onChange,
	className,
}: {
	initialBlueprint: Blueprint;
	isVisible?: boolean;
	onChange?: (blueprint: BlueprintBundle) => void;
	className?: string;
}) {
	const [filesystem, setFilesystem] =
		useState<AsyncWritableFilesystem | null>(null);

	const [selectedDirPath, setSelectedDirPath] = useState<string | null>('/');
	const [currentPath, setCurrentPath] = useState<string | null>(null);
	const [code, setCode] = useState<string>('');
	const [readOnly, setReadOnly] = useState<boolean>(true);
	const [saveState, setSaveState] = useState<SaveState>(SaveState.IDLE);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [showExplorerOnMobile, setShowExplorerOnMobile] =
		useState<boolean>(false);
	const [treeFocusPath, setTreeFocusPath] = useState<string | null>(null);
	const [messageContent, setMessageContent] = useState<
		string | JSX.Element | null
	>(null);

	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const skipNextSaveRef = useRef<boolean>(false);
	const codeRef = useRef<string>(code);
	const currentPathRef = useRef<string | null>(currentPath);
	const editorRef = useRef<CodeEditorHandle | null>(null);

	useEffect(() => {
		codeRef.current = code;
	}, [code]);

	useEffect(() => {
		currentPathRef.current = currentPath;
	}, [currentPath]);

	/**
	 * Create the writable filesystem once, on mount, and never change it afterwards.
	 */
	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const filesystem = await convertBlueprintToWritableFilesystem(
					initialBlueprint,
					onChange
				);
				const blueprintJsonContent =
					await filesystem.readFileAsText(BLUEPRINT_JSON_PATH);
				if (cancelled) return;
				setFilesystem(filesystem);
				setSelectedDirPath('/');

				try {
					await handleFileOpened(
						BLUEPRINT_JSON_PATH,
						blueprintJsonContent
					);
				} catch (error) {
					logger.error('Could not open blueprint.json', error);
				}

				if (cancelled) return;

				setMessageContent(null);
				setShowExplorerOnMobile(false);
				skipNextSaveRef.current = true;
				setTreeFocusPath(BLUEPRINT_JSON_PATH);
			} catch (error) {
				if (!cancelled) {
					logger.error(
						'Failed to initialize blueprint filesystem',
						error
					);
					setFilesystem(null);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
		// Deliberately no dependencies: we only initialize once
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Debounced autosave whenever the current file contents change.
	useEffect(() => {
		if (!filesystem || !currentPath) {
			if (saveTimeoutRef.current !== null) {
				clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
			if (!currentPath) {
				setSaveState(SaveState.IDLE);
			}
			return;
		}

		if (skipNextSaveRef.current) {
			skipNextSaveRef.current = false;
			return;
		}

		if (saveTimeoutRef.current !== null) {
			clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}

		setSaveState(SaveState.PENDING);
		const timeout = setTimeout(flushPendingSave, SAVE_DEBOUNCE_MS);
		saveTimeoutRef.current = timeout;

		return () => {
			if (saveTimeoutRef.current === timeout) {
				clearTimeout(timeout);
				saveTimeoutRef.current = null;
			}
		};
	}, [code, currentPath, filesystem]);

	// Fade out the "Saved" indicator after a moment.
	useEffect(() => {
		if (saveState === SaveState.SAVED) {
			const timeout = setTimeout(() => {
				setSaveState((previous) =>
					previous === SaveState.SAVED ? SaveState.IDLE : previous
				);
			}, 2000);
			return () => clearTimeout(timeout);
		}
	}, [saveState]);

	const flushPendingSave = useCallback(async () => {
		if (saveTimeoutRef.current !== null) {
			clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
		if (!filesystem || !currentPathRef.current) {
			return;
		}
		setSaveState(SaveState.SAVING);
		try {
			await filesystem.writeFile(currentPathRef.current, codeRef.current);
			setSaveState(SaveState.SAVED);
			setSaveError(null);
		} catch (error) {
			logger.error('Failed to save file', error);
			setSaveState(SaveState.ERROR);
			setSaveError('Could not save changes. Try again.');
		}
	}, [filesystem]);

	const handleFileOpened = useCallback(
		async (path: string, content: string, shouldFocus = true) => {
			try {
				await flushPendingSave();
			} catch (error) {
				logger.error('Failed to save file', error);
			}
			skipNextSaveRef.current = true;
			setCurrentPath(path);
			setCode(content);
			setMessageContent(null);
			setReadOnly(false);
			setSaveState(SaveState.IDLE);
			setSaveError(null);
			setShowExplorerOnMobile(false);
			setTreeFocusPath(path);

			if (shouldFocus) {
				setTimeout(() => editorRef.current?.focus(), 20);
			}
		},
		[filesystem]
	);

	const handleClearSelection = useCallback(async () => {
		try {
			await flushPendingSave();
		} catch {
			/* noop */
		}
		skipNextSaveRef.current = true;
		setCurrentPath(null);
		setCode('');
		setMessageContent(null);
		setReadOnly(true);
		setSaveState(SaveState.IDLE);
		setSaveError(null);
		setTreeFocusPath(null);
	}, [filesystem]);

	const handleShowMessage = useCallback(
		async (message: string | JSX.Element) => {
			try {
				await flushPendingSave();
			} catch {
				/* noop */
			}
			skipNextSaveRef.current = true;
			setCurrentPath(null);

			if (typeof message === 'string') {
				setCode(message);
				setMessageContent(null);
			} else {
				setCode('');
				setMessageContent(message);
			}

			setReadOnly(true);
			setSaveState(SaveState.IDLE);
			setSaveError(null);
			setShowExplorerOnMobile(false);
			setTreeFocusPath(null);
		},
		[filesystem]
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

	if (!filesystem) {
		return (
			<div className={styles.container}>
				<div className={styles.placeholder}>
					Load a Blueprint bundle to browse and edit its files.
				</div>
			</div>
		);
	}

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
							{currentPath?.length
								? currentPath
								: `Browse files under /`}
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
								onChange={setCode}
								currentPath={currentPath}
								className={styles.editor}
								onSaveShortcut={flushPendingSave}
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
}
