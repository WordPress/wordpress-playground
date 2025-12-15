import { autocompletion } from '@codemirror/autocomplete';
import { StateField, type Extension } from '@codemirror/state';
import {
	EditorView,
	keymap,
	showTooltip,
	type Tooltip,
} from '@codemirror/view';
import { logger } from '@php-wasm/logger';
import { Button, Icon, Notice } from '@wordpress/components';
import { download, link } from '@wordpress/icons';
import { encodeStringAsBase64 } from '../../lib/base64';
import {
	resolveRuntimeConfiguration,
	type BlueprintValidationResult,
} from '@wp-playground/blueprints';
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
import {
	formatEditor,
	getStringNodeAtPosition,
	jsonSchemaCompletion,
} from './json-schema-editor/jsonSchemaCompletion';
import { createBlueprintLinter } from './json-schema-editor/blueprint-linter';
import {
	inferLanguageFromBlueprint,
	type SupportedLanguage,
} from './infer-language-from-blueprint';
import { StringEditorModal } from './string-editor-modal';
// Reuse the file browser layout styles to keep UI consistent
import { useDebouncedCallback } from '../../lib/hooks/use-debounced-callback';
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import { sitesSlice } from '../../lib/state/redux/slice-sites';
import { useAppDispatch } from '../../lib/state/redux/store';
import styles from '../site-manager/site-file-browser/style.module.css';
import hideRootStyles from './hide-root.module.css';
import validationStyles from './validation-panel.module.css';
import type { EventedFilesystem } from '@wp-playground/storage';

const BLUEPRINT_JSON_PATH = '/blueprint.json';

/**
 * Format a validation error into a human-readable message for the error panel
 */
function formatValidationError(error: {
	keyword: string;
	message?: string;
	params?: Record<string, unknown>;
	instancePath: string;
}): string {
	// Provide better messages based on error type
	if (error.keyword === 'additionalProperties' && error.params) {
		const prop = error.params.additionalProperty;
		return `Unknown property "${prop}"`;
	}
	if (error.keyword === 'required' && error.params) {
		const prop = error.params.missingProperty;
		return `Missing required property "${prop}"`;
	}
	if (error.keyword === 'enum' && error.params) {
		const allowed = error.params.allowedValues;
		if (Array.isArray(allowed)) {
			return `Value must be one of: ${allowed.join(', ')}`;
		}
	}
	if (error.keyword === 'type' && error.params) {
		const expected = error.params.type;
		return `Expected ${expected}`;
	}
	return error.message || 'Validation error';
}

interface StringEditorState {
	isOpen: boolean;
	initialValue: string;
	language: SupportedLanguage;
	contentStart: number;
	contentEnd: number;
}

/**
 * Create the string editor toolbar tooltip extension
 */
function createStringEditorTooltip(openStringEditor: () => boolean): Extension {
	const stringEditorTooltipField = StateField.define<Tooltip | null>({
		create() {
			return null;
		},
		update(_tooltip, tr) {
			const pos = tr.state.selection.main.head;
			const stringInfo = getStringNodeAtPosition(tr.state.doc, pos);

			if (!stringInfo) {
				return null;
			}

			// Only show the button if the string can be JSON-parsed
			try {
				JSON.parse(`"${stringInfo.rawValue}"`);
			} catch {
				return null;
			}

			return {
				pos: stringInfo.contentStart,
				above: true,
				strictSide: true,
				arrow: false,
				create: (view: EditorView) => {
					const dom = document.createElement('div');
					dom.className = 'cm-string-editor-toolbar';

					const button = document.createElement('button');
					button.className = 'cm-string-editor-button';
					button.innerHTML = '✎ Multiline Edit';
					button.title = 'Edit string (Cmd/Ctrl+E)';
					button.onmousedown = (e) => {
						e.preventDefault();
						e.stopPropagation();
						openStringEditor();
					};

					dom.appendChild(button);

					// Keep the toolbar visible during horizontal scroll
					const updatePosition = () => {
						const tooltip = dom.parentElement;
						if (!tooltip) return;

						const scrollContainer = view.scrollDOM;
						const containerRect =
							scrollContainer.getBoundingClientRect();
						const tooltipRect = tooltip.getBoundingClientRect();

						// If tooltip would be to the left of the visible area, translate it right
						const minLeft = containerRect.left + 8; // 8px padding from edge
						if (tooltipRect.left < minLeft) {
							const offset = minLeft - tooltipRect.left;
							dom.style.transform = `translateX(${offset}px)`;
						} else {
							dom.style.transform = '';
						}
					};

					const scrollHandler = () => updatePosition();

					return {
						dom,
						mount: () => {
							view.scrollDOM.addEventListener(
								'scroll',
								scrollHandler
							);
							// Initial position check
							requestAnimationFrame(updatePosition);
						},
						destroy: () => {
							view.scrollDOM.removeEventListener(
								'scroll',
								scrollHandler
							);
						},
					};
				},
			};
		},
		provide: (field) =>
			showTooltip.compute([field], (state) => state.field(field)),
	});

	return [
		stringEditorTooltipField,
		// Styles for the string editor toolbar
		EditorView.baseTheme({
			'.cm-tooltip': {
				border: 'none',
				backgroundColor: 'transparent',
			},
			'.cm-string-editor-toolbar.cm-string-editor-toolbar': {
				display: 'flex',
				alignItems: 'center',
				padding: '0',
				background: '#1e1e1e',
				borderRadius: '6px',
				boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
			},
			'.cm-string-editor-button': {
				display: 'inline-flex',
				alignItems: 'center',
				gap: '4px',
				height: '24px',
				padding: '0 10px',
				border: 'none',
				borderRadius: '4px',
				background: 'transparent',
				color: '#fff',
				cursor: 'pointer',
				fontSize: '12px',
				fontFamily: 'system-ui, sans-serif',
				lineHeight: '1',
				transition: 'background 0.15s',
			},
			'.cm-string-editor-button:hover': {
				background: 'rgba(255,255,255,0.15)',
			},
		}),
	];
}

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
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [showExplorerOnMobile, setShowExplorerOnMobile] =
		useState<boolean>(false);
	const [treeFocusPath, setTreeFocusPath] = useState<string | null>(null);
	const [messageContent, setMessageContent] = useState<
		string | JSX.Element | null
	>(null);
	const [displayPath, setDisplayPath] = useState<string | null>(null);
	const [isRecreating, setIsRecreating] = useState(false);
	const [validationResult, setValidationResult] =
		useState<BlueprintValidationResult | null>(null);
	const [stringEditorState, setStringEditorState] =
		useState<StringEditorState>({
			isOpen: false,
			initialValue: '',
			language: 'plaintext',
			contentStart: 0,
			contentEnd: 0,
		});

	const editorRef = useRef<CodeEditorHandle | null>(null);
	// Store the CodeMirror EditorView for string editor operations
	const cmViewRef = useRef<EditorView | null>(null);
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

	// Open the string editor modal for the string at the current cursor position
	const openStringEditor = useCallback(() => {
		const view = cmViewRef.current;
		if (!view) return false;

		const pos = view.state.selection.main.head;
		const stringInfo = getStringNodeAtPosition(view.state.doc, pos);

		if (!stringInfo) return false;

		let parsedValue: string;
		try {
			parsedValue = JSON.parse(`"${stringInfo.rawValue}"`);
		} catch {
			return false;
		}

		const language = inferLanguageFromBlueprint(
			stringInfo.path,
			stringInfo.stepType,
			parsedValue
		);

		setStringEditorState({
			isOpen: true,
			initialValue: parsedValue,
			language,
			contentStart: stringInfo.contentStart,
			contentEnd: stringInfo.contentEnd,
		});

		return true;
	}, []);

	// Handle saving from the string editor modal
	const handleStringEditorSave = useCallback(
		(newValue: string) => {
			const view = cmViewRef.current;
			if (!view) return;

			// JSON.stringify adds surrounding quotes, so we strip them
			const escapedValue = JSON.stringify(newValue).slice(1, -1);

			view.dispatch({
				changes: {
					from: stringEditorState.contentStart,
					to: stringEditorState.contentEnd,
					insert: escapedValue,
				},
			});

			// Format the document after the change
			setTimeout(() => formatEditor(view), 0);
		},
		[stringEditorState.contentStart, stringEditorState.contentEnd]
	);

	const closeStringEditor = useCallback(() => {
		setStringEditorState((prev) => ({ ...prev, isOpen: false }));
		// Refocus the main editor
		setTimeout(() => editorRef.current?.focus(), 0);
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

	const handleValidationChange = useCallback(
		(result: BlueprintValidationResult | null) => {
			setValidationResult(result);
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
			createBlueprintLinter(handleValidationChange),
			// Capture the EditorView reference for string editor operations
			EditorView.updateListener.of((update) => {
				cmViewRef.current = update.view;
			}),
			// Keyboard shortcut to open string editor
			keymap.of([
				{
					key: 'Mod-e',
					preventDefault: true,
					run: () => openStringEditor(),
				},
			]),
			// String editor toolbar tooltip
			createStringEditorTooltip(openStringEditor),
		],
		[handleValidationChange, openStringEditor]
	);

	const hasValidationErrors =
		validationResult !== null && !validationResult.valid;

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

	const handleShareBlueprint = useCallback(async () => {
		try {
			// Check if the bundle contains anything other than blueprint.json
			const rootEntries = await filesystem.listFiles('/');
			if (
				rootEntries.length !== 1 ||
				rootEntries[0] !== 'blueprint.json'
			) {
				alert(
					'Linking to blueprint bundles is not supported yet. Only single-file blueprints can be shared via link.'
				);
				return;
			}

			// Read the blueprint.json content
			const blueprintContent =
				await filesystem.readFileAsText(BLUEPRINT_JSON_PATH);

			const base64Blueprint = encodeStringAsBase64(blueprintContent);
			const shareUrl = `${window.location.origin}${window.location.pathname}#${base64Blueprint}`;
			await navigator.clipboard.writeText(shareUrl);

			setSuccessMessage('Link copied to clipboard!');
			setTimeout(() => setSuccessMessage(null), 2000);
		} catch (error) {
			logger.error('Failed to share blueprint', error);
			setSaveError('Could not copy link. Try again.');
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

	const disableRunButton = isRecreating || !site || hasValidationErrors;
	return (
		<>
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
									setShowExplorerOnMobile(
										(previous) => !previous
									)
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
									onClick={handleShareBlueprint}
									title="Copy link to blueprint"
								>
									<Icon icon={link} />
								</Button>
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
										className={classNames(
											styles.editorToolbarButton,
											{
												[validationStyles.runButtonDisabled]:
													hasValidationErrors,
											}
										)}
										onClick={handleRecreateFromBlueprint}
										isBusy={isRecreating}
										disabled={disableRunButton}
										title={
											hasValidationErrors
												? 'Fix validation errors before running'
												: undefined
										}
									>
										<PlayIcon
											className={
												styles.editorToolbarPlayIcon
											}
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
						{successMessage ? (
							<div style={{ padding: '8px 16px' }}>
								<Notice status="success" isDismissible={false}>
									{successMessage}
								</Notice>
							</div>
						) : null}
						{currentPath || code || messageContent ? (
							messageContent ? (
								<div className={styles.messageArea}>
									{messageContent}
								</div>
							) : (
								<>
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
									{currentPath === BLUEPRINT_JSON_PATH &&
										hasValidationErrors &&
										!validationResult.valid && (
											<div
												className={
													validationStyles.validationPanel
												}
											>
												<div
													className={
														validationStyles.validationHeader
													}
												>
													<span
														className={
															validationStyles.validationIcon
														}
													>
														<svg
															viewBox="0 0 20 20"
															fill="currentColor"
														>
															<path
																fillRule="evenodd"
																d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
																clipRule="evenodd"
															/>
														</svg>
													</span>
													{validationResult.errors
														.length === 1
														? '1 validation error'
														: `${validationResult.errors.length} validation errors`}
												</div>
												<ul
													className={
														validationStyles.validationErrors
													}
												>
													{validationResult.errors.map(
														(error, index) => (
															<li
																key={index}
																className={
																	validationStyles.validationError
																}
															>
																{error.instancePath && (
																	<span
																		className={
																			validationStyles.errorPath
																		}
																	>
																		{
																			error.instancePath
																		}
																	</span>
																)}
																<span
																	className={
																		validationStyles.errorMessage
																	}
																>
																	{formatValidationError(
																		error
																	)}
																</span>
															</li>
														)
													)}
												</ul>
											</div>
										)}
								</>
							)
						) : (
							<div className={styles.placeholder}>
								Select a file to view or edit its contents.
							</div>
						)}
					</section>
				</div>
			</div>
			<StringEditorModal
				isOpen={stringEditorState.isOpen}
				initialValue={stringEditorState.initialValue}
				language={stringEditorState.language}
				onSave={handleStringEditorSave}
				onClose={closeStringEditor}
			/>
		</>
	);
});
