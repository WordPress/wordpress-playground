import { autocompletion } from '@codemirror/autocomplete';
import { StateField, type Extension } from '@codemirror/state';
import {
	EditorView,
	keymap,
	showTooltip,
	type Tooltip,
} from '@codemirror/view';
import { logger } from '@php-wasm/logger';
import { joinPaths } from '@php-wasm/util';
import { Button, Icon, Notice } from '@wordpress/components';
import { download } from '@wordpress/icons';
import type { BlueprintValidationResult } from '@wp-playground/blueprints';
import type {
	AsyncWritableFilesystem,
	EventedFilesystem,
} from '@wp-playground/storage';
import { BlobWriter, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js';
import classNames from 'classnames';
import React from 'react';
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
	FileExplorerSidebar,
	type CodeEditorHandle,
} from '../PlaygroundFileEditor';
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
import { useDebouncedCallback } from './use-debounced-callback';
import styles from './blueprint-bundle-editor.module.css';
import hideRootStyles from './hide-root.module.css';
import validationStyles from './validation-panel.module.css';

const BLUEPRINT_JSON_PATH = '/blueprint.json';

/** Edits the Blueprint bundle stored in a stable filesystem instance. */
export type BlueprintBundleEditorProps = {
	filesystem: EventedFilesystem;
	readOnly?: boolean;
	onChange?: (filesystem: EventedFilesystem) => void;
	onPreview?: (filesystem: EventedFilesystem) => void | Promise<void>;
};

export interface BlueprintBundleEditorHandle {
	downloadBundle: () => Promise<void>;
	getBundle: () => Promise<AsyncWritableFilesystem | null>;
	preview: () => Promise<void>;
}

export const BlueprintBundleEditor = forwardRef<
	BlueprintBundleEditorHandle,
	BlueprintBundleEditorProps
>(function BlueprintFilesystemEditor(
	{ filesystem, readOnly = false, onChange, onPreview },
	ref
) {
	const [selectedDirPath, setSelectedDirPath] = useState<string | null>('/');
	const [currentPath, setCurrentPath] = useState<string | null>(null);
	const [code, setCode] = useState<string>('');
	const [saveError, setSaveError] = useState<string | null>(null);
	const [showExplorerOnMobile, setShowExplorerOnMobile] =
		useState<boolean>(false);
	const [messageContent, setMessageContent] = useState<
		string | JSX.Element | null
	>(null);
	const [displayPath, setDisplayPath] = useState<string | null>(null);
	const [isPreviewing, setIsPreviewing] = useState(false);
	const [validationResult, setValidationResult] =
		useState<BlueprintValidationResult | null>(null);
	const hasValidationErrors =
		validationResult !== null && !validationResult.valid;
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
	/**
	 * `flush()` starts the latest delayed save. This ordered promise also includes
	 * earlier in-flight writes, so Preview can wait before reading the bundle.
	 */
	const saveBarrierRef = useRef<Promise<boolean>>(Promise.resolve(true));
	const previewInProgressRef = useRef(false);

	// Save file to filesystem
	const saveFile = useDebouncedCallback(enqueueSave, 200, [filesystem]);

	function enqueueSave(path: string, content: string): Promise<boolean> {
		saveBarrierRef.current = saveBarrierRef.current.then(async () => {
			try {
				await filesystem.writeFile(path, content);
				setSaveError(null);
				return true;
			} catch (error) {
				logger.error('Failed to save file', error);
				setSaveError('Could not save changes. Try again.');
				return false;
			}
		});
		return saveBarrierRef.current;
	}

	const handleCodeChange = useCallback(
		(newCode: string) => {
			if (readOnly || isPreviewing) {
				return;
			}
			setCode(newCode);
			if (currentPath) {
				saveFile(currentPath, newCode);
			}
		},
		[currentPath, isPreviewing, readOnly, saveFile]
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
			} catch (error) {
				logger.error('Could not open blueprint.json', error);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [filesystem]);

	// Report writes from the editor and from file-tree actions through one event.
	useEffect(() => {
		if (!onChange) {
			return;
		}
		const handleChange = () => onChange(filesystem);
		filesystem.addEventListener('change', handleChange);
		return () => filesystem.removeEventListener('change', handleChange);
	}, [filesystem, onChange]);

	const handlePreview = useCallback(async () => {
		if (!onPreview || hasValidationErrors || previewInProgressRef.current) {
			return;
		}
		previewInProgressRef.current = true;
		setIsPreviewing(true);
		try {
			saveFile.flush();
			if (!(await saveBarrierRef.current)) {
				return;
			}
			await onPreview(filesystem);
		} catch (error) {
			logger.error('Failed to preview Blueprint', error);
			setSaveError('Could not preview Blueprint. Try again.');
		} finally {
			previewInProgressRef.current = false;
			setIsPreviewing(false);
		}
	}, [filesystem, hasValidationErrors, onPreview, saveFile]);

	const handleFileOpened = useCallback(
		(path: string, content: string, shouldFocus = true) => {
			setCurrentPath(path);
			setCode(content);
			setDisplayPath(path);
			setMessageContent(null);
			setSaveError(null);
			setShowExplorerOnMobile(false);

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
			if (readOnly || isPreviewing) {
				return;
			}
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
		[
			isPreviewing,
			readOnly,
			stringEditorState.contentEnd,
			stringEditorState.contentStart,
		]
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

	const handleDownloadBundle = useCallback(async () => {
		try {
			saveFile.flush();
			if (!(await saveBarrierRef.current)) {
				return;
			}
			const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
			const addEntries = async (dirPath: string, prefix: string) => {
				const entries = await filesystem.listFiles(dirPath);
				for (const name of entries) {
					const absPath = joinPaths(dirPath, name);
					const relative = prefix ? joinPaths(prefix, name) : name;
					if (await filesystem.isDir(absPath)) {
						await addEntries(absPath, relative);
					} else {
						const file = await filesystem.read(absPath);
						const buffer = new Uint8Array(await file.arrayBuffer());
						await zipWriter.add(
							relative,
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
	}, [filesystem, saveFile]);

	useImperativeHandle(
		ref,
		() => ({
			downloadBundle: handleDownloadBundle,
			getBundle: async () => filesystem,
			preview: handlePreview,
		}),
		[filesystem, handleDownloadBundle, handlePreview]
	);

	const mobileExplorerToggle = (
		<Button
			className={styles['mobileToggle']}
			variant="secondary"
			onClick={() => setShowExplorerOnMobile((previous) => !previous)}
		>
			{showExplorerOnMobile ? 'Hide files' : 'Browse files'}
		</Button>
	);

	return (
		<>
			<div className={styles['container']}>
				<div
					className={classNames(styles['content'], {
						[styles['sidebarOpen']]: showExplorerOnMobile,
					})}
				>
					<div
						className={styles['mobileOverlay']}
						onClick={() => setShowExplorerOnMobile(false)}
					/>
					<aside
						className={classNames(
							styles['sidebarWrapper'],
							hideRootStyles['hideRoot']
						)}
					>
						<FileExplorerSidebar
							filesystem={filesystem}
							currentPath={currentPath}
							selectedDirPath={selectedDirPath}
							setSelectedDirPath={setSelectedDirPath}
							onFileOpened={handleFileOpened}
							onSelectionCleared={handleClearSelection}
							onShowMessage={handleShowMessage}
							documentRoot="/"
							readOnly={readOnly || isPreviewing}
						/>
					</aside>
					<section className={styles['editorWrapper']}>
						<div className={styles['editorHeader']}>
							{mobileExplorerToggle}
							<div
								className={classNames(styles['editorPath'], {
									[styles['editorPathPlaceholder']]:
										!currentPath?.length,
								})}
							>
								{displayPath ||
									selectedDirPath ||
									'Browse files under /'}
							</div>
							<div className={styles['editorHeaderActions']}>
								<Button
									variant="tertiary"
									className={styles['editorToolbarButton']}
									onClick={handleDownloadBundle}
									title="Download bundle"
								>
									<Icon icon={download} />
								</Button>
								{onPreview ? (
									<Button
										variant="primary"
										className={classNames(
											styles['editorToolbarButton'],
											{
												[validationStyles[
													'runButtonDisabled'
												]]: hasValidationErrors,
											}
										)}
										onClick={handlePreview}
										isBusy={isPreviewing}
										disabled={
											isPreviewing || hasValidationErrors
										}
										title={
											hasValidationErrors
												? 'Fix validation errors before previewing'
												: undefined
										}
									>
										<PreviewIcon
											className={
												styles[
													'editorToolbarPreviewIcon'
												]
											}
										/>
										Preview
									</Button>
								) : null}
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
								<div className={styles['messageArea']}>
									{messageContent}
								</div>
							) : (
								<>
									<CodeEditor
										ref={editorRef}
										code={code}
										onChange={handleCodeChange}
										currentPath={currentPath}
										className={styles['editor']}
										readOnly={readOnly || isPreviewing}
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
													validationStyles[
														'validationPanel'
													]
												}
											>
												<div
													className={
														validationStyles[
															'validationHeader'
														]
													}
												>
													<span
														className={
															validationStyles[
																'validationIcon'
															]
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
														validationStyles[
															'validationErrors'
														]
													}
												>
													{validationResult.errors.map(
														(error, index) => (
															<li
																key={index}
																className={
																	validationStyles[
																		'validationError'
																	]
																}
															>
																{error.instancePath && (
																	<span
																		className={
																			validationStyles[
																				'errorPath'
																			]
																		}
																	>
																		{
																			error.instancePath
																		}
																	</span>
																)}
																<span
																	className={
																		validationStyles[
																			'errorMessage'
																		]
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
							<div className={styles['placeholder']}>
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
		const prop = error.params['additionalProperty'];
		return `Unknown property "${prop}"`;
	}
	if (error.keyword === 'required' && error.params) {
		const prop = error.params['missingProperty'];
		return `Missing required property "${prop}"`;
	}
	if (error.keyword === 'enum' && error.params) {
		const allowed = error.params['allowedValues'];
		if (Array.isArray(allowed)) {
			return `Value must be one of: ${allowed.join(', ')}`;
		}
	}
	if (error.keyword === 'type' && error.params) {
		const expected = error.params['type'];
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

const PreviewIcon = ({ className }: { className?: string }) => (
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
