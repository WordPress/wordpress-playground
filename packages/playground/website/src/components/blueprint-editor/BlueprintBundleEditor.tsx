import { autocompletion } from '@codemirror/autocomplete';
import { StateField, type Extension } from '@codemirror/state';
import {
	EditorView,
	keymap,
	showTooltip,
	type Tooltip,
} from '@codemirror/view';
import { logger } from '@php-wasm/logger';
import {
	Button,
	Dropdown,
	Icon,
	MenuGroup,
	MenuItem,
	Notice,
	Tooltip as WpTooltip,
} from '@wordpress/components';
import { chevronDown, download, help, link } from '@wordpress/icons';
import {
	resolveRuntimeConfiguration,
	type BlueprintValidationResult,
} from '@wp-playground/blueprints';
import type {
	AsyncWritableFilesystem,
	EventedFilesystem,
} from '@wp-playground/storage';
import { BlobWriter, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import {
	forwardRef,
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	CodeEditor,
	FileExplorerSidebar,
	type CodeEditorHandle,
} from '@wp-playground/components';
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
import { useBlueprintUrlHash } from '../../lib/hooks/use-blueprint-url-hash';
import { useDebouncedCallback } from '../../lib/hooks/use-debounced-callback';
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import {
	createStoredSite,
	isAutosavedSite,
	isStoredSite,
	pruneAutosavedSites,
	type SiteInfo,
	updateSite,
} from '../../lib/state/redux/slice-sites';
import { setActiveSite, useAppDispatch } from '../../lib/state/redux/store';
import { setDockPaneOpen } from '../../lib/state/redux/slice-ui';
import styles from './blueprint-bundle-editor.module.css';
import hideRootStyles from './hide-root.module.css';
import validationStyles from './validation-panel.module.css';

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
	filesystem: EventedFilesystem;
	className?: string;
	site?: SiteInfo;
	autoRunToken?: number;
	readOnly?: boolean;
	dockPresentation?: boolean;
	/** Mobile Dock title row where Browse and Export should be rendered. */
	mobileHeaderTarget?: Element | null;
};

export interface BlueprintBundleEditorHandle {
	downloadBundle: () => Promise<void>;
	getBundle: () => Promise<AsyncWritableFilesystem | null>;
	runBlueprint: () => Promise<void>;
}

export const BlueprintBundleEditor = forwardRef<
	BlueprintBundleEditorHandle,
	BlueprintBundleEditorProps
>(function BlueprintFilesystemEditor(
	{
		filesystem,
		className,
		site,
		autoRunToken,
		readOnly,
		dockPresentation = false,
		mobileHeaderTarget = null,
	},
	ref
) {
	const [selectedDirPath, setSelectedDirPath] = useState<string | null>('/');
	const [currentPath, setCurrentPath] = useState<string | null>(null);
	const [code, setCode] = useState<string>('');
	const [saveError, setSaveError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [showExplorerOnMobile, setShowExplorerOnMobile] =
		useState<boolean>(false);
	const [messageContent, setMessageContent] = useState<
		string | JSX.Element | null
	>(null);
	const [displayPath, setDisplayPath] = useState<string | null>(null);
	const [isRunningBlueprint, setIsRunningBlueprint] = useState(false);
	const [validationResult, setValidationResult] =
		useState<BlueprintValidationResult | null>(null);
	const hasValidationErrors =
		validationResult !== null && !validationResult.valid;
	const copyBlueprintUrlHintId = useId();
	const [stringEditorState, setStringEditorState] =
		useState<StringEditorState>({
			isOpen: false,
			initialValue: '',
			language: 'plaintext',
			contentStart: 0,
			contentEnd: 0,
		});

	// Use the URL hash hook to track shareability and compute URL hash
	const { urlHash, isShareable: isBundleShareable } = useBlueprintUrlHash(
		filesystem as EventedFilesystem,
		currentPath === BLUEPRINT_JSON_PATH ? code : '',
		{ disabled: readOnly || currentPath !== BLUEPRINT_JSON_PATH }
	);
	const newUrl = useMemo(() => {
		if (readOnly) {
			return false;
		}
		const url = new URL(window.location.href);
		if (urlHash) {
			url.hash = urlHash;
		} else if (url.hash) {
			url.hash = '';
		} else {
			return false;
		}
		return url.toString();
	}, [urlHash, readOnly]);

	const editorRef = useRef<CodeEditorHandle | null>(null);
	// Store the CodeMirror EditorView for string editor operations
	const cmViewRef = useRef<EditorView | null>(null);
	/**
	 * `flush()` starts the latest delayed save. This ordered promise also includes
	 * earlier in-flight writes, so Run can wait before reading the Blueprint bundle.
	 */
	const saveBarrierRef = useRef<Promise<boolean>>(Promise.resolve(true));
	const runInProgressRef = useRef(false);
	const dispatch = useAppDispatch();

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
			if (readOnly || isRunningBlueprint) {
				return;
			}
			setCode(newCode);
			if (currentPath) {
				saveFile(currentPath, newCode);
			}
		},
		[currentPath, isRunningBlueprint, readOnly, saveFile]
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

	// Sync the URL hash from the hook to the browser's location
	useEffect(() => {
		if (false !== newUrl) {
			window.history.replaceState(null, '', newUrl.toString());
		}
	}, [newUrl]);

	const handleRunBlueprint = useCallback(async () => {
		if (
			!site ||
			readOnly ||
			hasValidationErrors ||
			runInProgressRef.current
		) {
			return;
		}
		runInProgressRef.current = true;
		const runInNewPlayground = isStoredSite(site);
		try {
			setIsRunningBlueprint(true);
			saveFile.flush();
			if (!(await saveBarrierRef.current)) {
				return;
			}
			setSaveError(null);
			if (runInNewPlayground) {
				const newSite = await dispatch(
					createStoredSite(
						site.metadata.name,
						filesystem.backend,
						undefined,
						{ persistence: 'autosave' }
					)
				);
				try {
					await dispatch(
						pruneAutosavedSites({
							excludeSlugs: [site.slug, newSite.slug],
						})
					);
				} catch (error) {
					// The new Playground is already committed. Retention cleanup is
					// housekeeping and must not turn a successful run into a retry
					// that creates a duplicate Playground.
					logger.error(
						'Failed to prune autosaved Playgrounds',
						error
					);
				}
				dispatch(setDockPaneOpen(false));
				dispatch(setActiveSite(newSite.slug));
				return;
			}
			const runtimeConfiguration = await resolveRuntimeConfiguration(
				filesystem as any
			);
			const changes = {
				metadata: {
					...site.metadata,
					originalBlueprintSource: { type: 'none' as const },
					originalBlueprint: filesystem,
					runtimeConfiguration,
					initialOpfsSyncPending:
						site.metadata.initialOpfsSyncPending,
					playgroundDefinedConstants:
						site.metadata.playgroundDefinedConstants,
					whenCreated: Date.now(),
				},
				originalUrlParams: undefined,
			};
			dispatch(removeClientInfo(site.slug));
			await dispatch(
				updateSite({
					slug: site.slug,
					changes,
				})
			);
		} catch (error) {
			logger.error('Failed to run Blueprint', error);
			setSaveError(
				runInNewPlayground
					? 'Could not create Playground. Try again.'
					: 'Could not recreate Playground. Try again.'
			);
		} finally {
			runInProgressRef.current = false;
			setIsRunningBlueprint(false);
		}
	}, [dispatch, filesystem, hasValidationErrors, readOnly, saveFile, site]);

	// autorun token hook
	useEffect(() => {
		if (autoRunToken === undefined) return;
		void handleRunBlueprint();
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
			if (readOnly || isRunningBlueprint) {
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
			isRunningBlueprint,
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

	const handleShareBlueprint = async () => {
		if (false === newUrl) {
			alert(
				'Linking to blueprint bundles is not supported yet. Only single-file blueprints can be shared via link.'
			);
			return;
		}
		try {
			await navigator.clipboard.writeText(newUrl);

			setSuccessMessage('Link copied to clipboard!');
			setTimeout(() => setSuccessMessage(null), 2000);
		} catch (error) {
			logger.error('Failed to share blueprint', error);
			setSaveError('Could not copy link. Try again.');
		}
	};

	useImperativeHandle(
		ref,
		() => ({
			downloadBundle: handleDownloadBundle,
			getBundle: async () => filesystem,
			runBlueprint: handleRunBlueprint,
		}),
		[handleDownloadBundle, filesystem, handleRunBlueprint]
	);

	const isAutosaved = site ? isAutosavedSite(site) : false;
	const isStored = site ? isStoredSite(site) : false;
	const disableRunButton = isRunningBlueprint || !site || hasValidationErrors;
	const mobileExplorerToggle = (
		<Button
			className={styles.mobileToggle}
			variant="secondary"
			onClick={() => setShowExplorerOnMobile((previous) => !previous)}
		>
			{showExplorerOnMobile ? 'Hide files' : 'Browse files'}
		</Button>
	);
	const dockExportDropdown = (
		<Dropdown
			className={styles.editorExport}
			popoverProps={{
				placement: 'bottom-end',
			}}
			renderToggle={({ isOpen, onToggle }) => (
				<Button
					variant="secondary"
					className={classNames(
						styles.editorToolbarButton,
						styles.editorExportToggle
					)}
					onClick={onToggle}
					aria-expanded={isOpen}
					aria-haspopup="menu"
				>
					Export
					<Icon icon={chevronDown} size={16} />
				</Button>
			)}
			renderContent={({ onClose }) => (
				<MenuGroup>
					<MenuItem
						icon={link}
						className={
							!isBundleShareable
								? styles.exportMenuItemWithHint
								: undefined
						}
						aria-label="Copy Blueprint URL"
						aria-describedby={
							!isBundleShareable
								? copyBlueprintUrlHintId
								: undefined
						}
						disabled={!isBundleShareable}
						onClick={() => {
							handleShareBlueprint();
							onClose();
						}}
					>
						<span className={styles.exportMenuItemBody}>
							<span>Copy Blueprint URL</span>
							{!isBundleShareable && (
								<span
									id={copyBlueprintUrlHintId}
									className={styles.exportMenuItemHint}
								>
									Multi-file Blueprints can’t be shared as a
									URL — download a zip instead.
								</span>
							)}
						</span>
					</MenuItem>
					<MenuItem
						icon={download}
						onClick={() => {
							handleDownloadBundle();
							onClose();
						}}
					>
						Download Zip
					</MenuItem>
				</MenuGroup>
			)}
		/>
	);
	const dockDocsLink = (
		<WpTooltip
			text="See Blueprints documentation"
			delay={0}
			placement="top"
		>
			<a
				className={styles.editorDocsLink}
				href="https://wordpress.github.io/wordpress-playground/blueprints"
				target="_blank"
				rel="noreferrer"
				aria-label="See Blueprints documentation"
			>
				<Icon icon={help} size={24} />
			</a>
		</WpTooltip>
	);
	const mobileHeaderActions = mobileHeaderTarget
		? createPortal(
				<div
					className={styles.editorHeaderSlotActions}
					data-dock-pane-header-actions
				>
					<div
						className={styles.editorHeaderHelp}
						data-dock-pane-header-help
					>
						{dockDocsLink}
					</div>
					<div
						className={styles.editorHeaderFileActions}
						data-dock-pane-header-utilities
					>
						{mobileExplorerToggle}
						{dockExportDropdown}
					</div>
				</div>,
				mobileHeaderTarget
			)
		: null;
	return (
		<>
			{mobileHeaderActions}
			<div
				className={classNames(styles.container, className, {
					[styles.dockPresentation]: dockPresentation,
				})}
			>
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
							onFileOpened={handleFileOpened}
							onSelectionCleared={handleClearSelection}
							onShowMessage={handleShowMessage}
							documentRoot="/"
							readOnly={readOnly || isRunningBlueprint}
							{...(dockPresentation
								? {
										title: 'Blueprint',
										showBinaryPreviewHeader: false,
										dockPresentation: true,
										useWordPressTooltips: true,
									}
								: {})}
						/>
					</aside>
					<section className={styles.editorWrapper}>
						<div className={styles.editorHeader}>
							{!dockPresentation && mobileExplorerToggle}
							{!dockPresentation && (
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
							)}

							<div
								className={classNames(
									styles.editorHeaderActions,
									{
										[styles.editorHeaderActionsWithPortaledUtilities]:
											mobileHeaderTarget,
									}
								)}
							>
								{dockPresentation &&
									!mobileHeaderTarget &&
									mobileExplorerToggle}
								{dockPresentation ? (
									!mobileHeaderTarget && (
										<>
											{dockDocsLink}
											{dockExportDropdown}
										</>
									)
								) : (
									<>
										<Button
											variant="tertiary"
											className={
												styles.editorToolbarButton
											}
											onClick={handleShareBlueprint}
											title="Copy link to blueprint"
											aria-label="Copy link to blueprint"
											disabled={!isBundleShareable}
										>
											<Icon icon={link} />
										</Button>
										<Button
											variant="tertiary"
											className={
												styles.editorToolbarButton
											}
											onClick={handleDownloadBundle}
											title="Download bundle"
										>
											<Icon icon={download} />
										</Button>
									</>
								)}
								{!readOnly && (
									<Button
										variant="primary"
										isDestructive={!isStored}
										className={classNames(
											styles.editorToolbarButton,
											{
												[validationStyles.runButtonDisabled]:
													hasValidationErrors,
											}
										)}
										onClick={handleRunBlueprint}
										isBusy={isRunningBlueprint}
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
										{isStored
											? 'Run in a new Playground'
											: 'Discard current Playground & run Blueprint'}
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
						{!dockPresentation &&
						!readOnly &&
						!isBundleShareable ? (
							<div style={{ padding: '8px 16px' }}>
								<Notice status="warning" isDismissible={false}>
									This Blueprint bundle contains multiple
									files and cannot be shared via URL. Use the
									download button to export the bundle as a
									zip file.
								</Notice>
							</div>
						) : null}
						{isStored ? (
							<p className={styles.runHint}>
								Running this Blueprint creates a fresh autosaved
								Playground. “{site?.metadata.name}” stays in{' '}
								{isAutosaved
									? 'Recent autosaves'
									: 'Saved Playgrounds'}
								.
							</p>
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
										readOnly={
											readOnly || isRunningBlueprint
										}
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
