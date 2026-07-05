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
import {
	Button,
	Dropdown,
	MenuGroup,
	MenuItem,
	Notice,
} from '@wordpress/components';
import { Icon, chevronDown, download, help, link } from '@wordpress/icons';
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
import { CodeEditor, type CodeEditorHandle } from '@wp-playground/components';
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
import { useBlueprintUrlHash } from '../../lib/hooks/use-blueprint-url-hash';
import { useDebouncedCallback } from '../../lib/hooks/use-debounced-callback';
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import { setSiteManagerOpen } from '../../lib/state/redux/slice-ui';
import {
	getAutosaveFingerprintFromURL,
	getSetupUrlFromUrl,
} from '../../lib/state/playground-identity';
import {
	isAutosavedSite,
	sitesSlice,
	type SiteInfo,
	updateSite,
} from '../../lib/state/redux/slice-sites';
import { useAppDispatch } from '../../lib/state/redux/store';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
import { resetAutosavedSiteFilesWithPendingMarker } from '../../lib/state/opfs/opfs-autosave-reset';
import styles from './blueprint-bundle-editor.module.css';
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
					button.textContent = '✎ Multiline Edit';
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
				background: 'var(--paper-2, #faf8f5)',
				border: '1px solid var(--line-subtle, rgba(33,32,29,0.1))',
				borderRadius: 'var(--radius-control, 6px)',
				boxShadow: '0 2px 8px rgba(40,33,23,0.16)',
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
				color: 'var(--ink, #21201d)',
				cursor: 'pointer',
				fontSize: '12px',
				fontFamily: 'system-ui, sans-serif',
				lineHeight: '1',
				transition: 'background 0.15s',
			},
			'.cm-string-editor-button:hover': {
				background: 'var(--paper-4, rgba(33,32,29,0.08))',
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
	const successMessageTimerRef = useRef<number | undefined>(undefined);
	const [showExplorerOnMobile, setShowExplorerOnMobile] =
		useState<boolean>(false);
	const [treeFocusPath, setTreeFocusPath] = useState<string | null>(null);
	const [messageContent, setMessageContent] = useState<
		string | JSX.Element | null
	>(null);
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

	// Track whether this bundle can be represented by a single Blueprint URL.
	const {
		urlHash,
		isShareable: isBundleShareable,
		isCheckingShareability,
		hasComputedUrlHash,
	} = useBlueprintUrlHash(
		filesystem as EventedFilesystem,
		currentPath === BLUEPRINT_JSON_PATH ? code : '',
		{ disabled: readOnly || currentPath !== BLUEPRINT_JSON_PATH }
	);
	const hasValidationErrors =
		validationResult !== null && !validationResult.valid;

	useEffect(() => {
		return () => {
			if (successMessageTimerRef.current !== undefined) {
				window.clearTimeout(successMessageTimerRef.current);
			}
		};
	}, []);

	const currentBlueprintShareUrl = useMemo(() => {
		if (
			readOnly ||
			currentPath !== BLUEPRINT_JSON_PATH ||
			isCheckingShareability ||
			!hasComputedUrlHash ||
			!isBundleShareable ||
			!urlHash
		) {
			return null;
		}
		try {
			const parsed = JSON.parse(code);
			if (
				typeof parsed !== 'object' ||
				parsed === null ||
				Array.isArray(parsed) ||
				hasValidationErrors
			) {
				return null;
			}
			// Drop route/UI params so the copied link boots this Blueprint,
			// rather than reopening the current stored Playground by slug.
			const url = getSetupUrlFromUrl(new URL(window.location.href));
			url.hash = urlHash;
			return url.toString();
		} catch {
			return null;
		}
	}, [
		code,
		currentPath,
		hasValidationErrors,
		hasComputedUrlHash,
		isBundleShareable,
		isCheckingShareability,
		readOnly,
		urlHash,
	]);
	const copyBlueprintUrlDisabledReason = useMemo(() => {
		if (currentBlueprintShareUrl) {
			return null;
		}
		if (readOnly) {
			return 'Saved Playgrounds keep their Blueprint read-only here.';
		}
		if (currentPath !== BLUEPRINT_JSON_PATH) {
			return 'Open blueprint.json to copy a Blueprint URL.';
		}
		if (isCheckingShareability || !hasComputedUrlHash) {
			return 'Checking whether this Blueprint can be shared as a URL…';
		}
		if (!isBundleShareable) {
			return 'Multi-file Blueprints can’t be shared as a URL — download a zip instead.';
		}
		if (hasValidationErrors) {
			return 'Fix validation errors before copying a Blueprint URL.';
		}
		return 'Fix the Blueprint JSON before copying a URL.';
	}, [
		currentBlueprintShareUrl,
		currentPath,
		hasValidationErrors,
		hasComputedUrlHash,
		isBundleShareable,
		isCheckingShareability,
		readOnly,
	]);

	const editorRef = useRef<CodeEditorHandle | null>(null);
	// Store the CodeMirror EditorView for string editor operations
	const cmViewRef = useRef<EditorView | null>(null);
	const codeRef = useRef(code);
	const currentPathRef = useRef(currentPath);
	const editorActionIdRef = useRef(0);
	const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
	const dispatch = useAppDispatch();

	useEffect(() => {
		codeRef.current = code;
	}, [code]);

	useEffect(() => {
		currentPathRef.current = currentPath;
	}, [currentPath]);

	const queueBlueprintWrite = useCallback(
		async (path: string, content: string, shouldWrite?: () => boolean) => {
			const write = async () => {
				if (shouldWrite && !shouldWrite()) {
					return;
				}
				await filesystem.writeFile(path, content);
			};
			const queuedWrite = writeQueueRef.current
				.catch(() => undefined)
				.then(write);
			writeQueueRef.current = queuedWrite.catch(() => undefined);
			await queuedWrite;
		},
		[filesystem]
	);

	// Save file to filesystem
	const saveFile = useDebouncedCallback(
		async (path: string, content: string) => {
			try {
				await queueBlueprintWrite(
					path,
					content,
					() =>
						currentPathRef.current === path &&
						codeRef.current === content
				);
				if (
					currentPathRef.current === path &&
					codeRef.current === content
				) {
					setSaveError(null);
				}
			} catch (error) {
				logger.error('Failed to save file', error);
				if (
					currentPathRef.current === path &&
					codeRef.current === content
				) {
					setSaveError('Could not save changes. Try again.');
				}
			}
		},
		200,
		[filesystem, queueBlueprintWrite]
	);

	const handleCodeChange = useCallback(
		(newCode: string) => {
			if (newCode === codeRef.current) {
				return;
			}
			codeRef.current = newCode;
			setCode(newCode);
			if (currentPathRef.current) {
				saveFile(currentPathRef.current, newCode);
			}
		},
		[saveFile]
	);

	const flushCurrentFile = useCallback(async () => {
		const pathToSave = currentPathRef.current;
		if (!pathToSave || readOnly) {
			return;
		}
		try {
			// Keep draining while the same file is open. The editor remains
			// interactive during forced flushes (file switch, run, download), so a
			// write that started with an older buffer must not be the last saved
			// snapshot if the user typed again before it settled.
			while (currentPathRef.current === pathToSave) {
				const contentToSave = codeRef.current;
				const editorChanged = () =>
					currentPathRef.current !== pathToSave ||
					codeRef.current !== contentToSave;
				await queueBlueprintWrite(
					pathToSave,
					contentToSave,
					() => !editorChanged()
				);
				if (!editorChanged()) {
					break;
				}
			}
			setSaveError(null);
		} catch (error) {
			logger.error('Failed to save file', error);
			setSaveError('Could not save changes. Try again.');
			throw error;
		}
	}, [queueBlueprintWrite, readOnly]);

	// The Blueprint editor saves after a short debounce. Closing the pane,
	// switching Playgrounds, or replacing the backing filesystem before that
	// debounce fires must still persist the latest edit instead of letting the
	// cleanup cancel it.
	useEffect(() => {
		return () => {
			const pathToSave = currentPathRef.current;
			if (!pathToSave || readOnly) {
				return;
			}
			const contentToSave = codeRef.current;
			void (async () => {
				try {
					await queueBlueprintWrite(pathToSave, contentToSave);
				} catch (error) {
					logger.error(
						'Failed to flush pending Blueprint save on unmount',
						error
					);
				}
			})();
		};
	}, [queueBlueprintWrite, readOnly]);

	// Load initial blueprint.json and focus tree
	useEffect(() => {
		let cancelled = false;
		const actionId = ++editorActionIdRef.current;
		(async () => {
			try {
				const blueprintJsonContent =
					await filesystem.readFileAsText(BLUEPRINT_JSON_PATH);
				if (cancelled || editorActionIdRef.current !== actionId) {
					return;
				}
				currentPathRef.current = BLUEPRINT_JSON_PATH;
				codeRef.current = blueprintJsonContent;
				setCurrentPath(BLUEPRINT_JSON_PATH);
				setCode(blueprintJsonContent);
				setSaveError(null);
				setMessageContent(null);
				setShowExplorerOnMobile(false);
				setTreeFocusPath(BLUEPRINT_JSON_PATH);
				// Land the cursor in the editor so the Blueprint is ready to
				// edit the moment the panel opens. The delay lets the editor
				// mount after this state update.
				setTimeout(() => {
					if (!cancelled && editorActionIdRef.current === actionId) {
						editorRef.current?.focus();
					}
				}, 80);
			} catch (error) {
				logger.error('Could not open blueprint.json', error);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [filesystem]);

	const handleRecreateFromBlueprint = useCallback(async () => {
		if (
			!site ||
			readOnly ||
			(site.metadata.storage !== 'none' && !isAutosavedSite(site))
		) {
			return;
		}
		try {
			setIsRecreating(true);
			await flushCurrentFile();
			const isAutosaved = isAutosavedSite(site);
			if (isAutosaved && !opfsSiteStorage) {
				throw new Error(
					'Cannot recreate autosaved Playground because browser storage is not available.'
				);
			}
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
			const recreatedAt = Date.now();
			const editedBundleSetupUrl =
				createEditedBundleSetupUrlFingerprintSource(
					site.slug,
					recreatedAt
				);
			const usesEditedBundleFingerprint =
				isAutosaved || site.metadata.storage === 'none';
			let changes: {
				metadata: SiteInfo['metadata'];
				originalUrlParams: SiteInfo['originalUrlParams'];
			} = {
				metadata: {
					...site.metadata,
					originalBlueprintSource: isAutosaved
						? { type: 'opfs-site' as const }
						: { type: 'none' as const },
					originalBlueprint: isAutosaved
						? (filesystem as EventedFilesystem).backend
						: bundle,
					runtimeConfiguration,
					initialOpfsSyncPending:
						isAutosaved || site.metadata.initialOpfsSyncPending,
					/**
					 * Recreating an autosaved Playground discards the old WordPress
					 * files and boots from the edited Blueprint. Constants discovered
					 * from the previous runtime may no longer exist in the recreated
					 * site, so they must be rediscovered after the first OPFS sync.
					 */
					playgroundDefinedConstants: isAutosaved
						? undefined
						: site.metadata.playgroundDefinedConstants,
					// A temporary site can be autosaved after it runs an edited
					// bundle. Give that bundle its own fingerprint immediately so
					// restore matching cannot confuse it with the original setup URL.
					sourceSetupUrlFingerprint: usesEditedBundleFingerprint
						? getAutosaveFingerprintFromURL(editedBundleSetupUrl)
						: site.metadata.sourceSetupUrlFingerprint,
					whenCreated: recreatedAt,
				},
				// Keep the human-facing setup URL and runtime-only query params
				// such as `php-extension`. The unique edited-bundle fingerprint
				// above is what prevents autosave restore matching from treating
				// the recreated site as the original setup URL.
				originalUrlParams: site.originalUrlParams,
			};
			if (isAutosaved) {
				changes = await resetAutosavedSiteFilesWithPendingMarker(
					site.slug,
					changes
				);
			}
			if (isAutosaved) {
				// The OPFS metadata write already happened before reset above.
				// Update Redux directly now so a second worker write can't fail
				// after the old files have already been deleted.
				dispatch(
					sitesSlice.actions.updateSite({
						id: site.slug,
						changes,
					})
				);
			} else {
				await dispatch(
					updateSite({
						slug: site.slug,
						changes,
					})
				);
			}
			dispatch(removeClientInfo(site.slug));
			// Applying the Blueprint boots a fresh Playground — get the editor
			// pane out of the way so the user sees it come up.
			dispatch(setSiteManagerOpen(false));
		} catch (error) {
			logger.error('Failed to recreate from blueprint', error);
			setSaveError('Could not recreate Playground. Try again.');
		} finally {
			setIsRecreating(false);
		}
	}, [dispatch, filesystem, flushCurrentFile, readOnly, site]);

	// autorun token hook
	useEffect(() => {
		if (autoRunToken === undefined) return;
		void handleRecreateFromBlueprint();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoRunToken]);

	const handleFileOpened = useCallback(
		async (path: string, content: string, shouldFocus = true) => {
			const actionId = ++editorActionIdRef.current;
			await flushCurrentFile();
			if (editorActionIdRef.current !== actionId) {
				return;
			}
			if (path === currentPathRef.current) {
				setShowExplorerOnMobile(false);
				if (shouldFocus) {
					setTimeout(() => {
						if (editorActionIdRef.current === actionId) {
							editorRef.current?.focus();
						}
					}, 20);
				}
				return;
			}
			currentPathRef.current = path;
			codeRef.current = content;
			setCurrentPath(path);
			setCode(content);
			setMessageContent(null);
			setSaveError(null);
			setShowExplorerOnMobile(false);
			setTreeFocusPath(path);

			if (shouldFocus) {
				setTimeout(() => {
					if (editorActionIdRef.current === actionId) {
						editorRef.current?.focus();
					}
				}, 20);
			}
		},
		[flushCurrentFile]
	);

	const handleClearSelection = useCallback(async () => {
		const actionId = ++editorActionIdRef.current;
		await flushCurrentFile();
		if (editorActionIdRef.current !== actionId) {
			return;
		}
		currentPathRef.current = null;
		codeRef.current = '';
		setCurrentPath(null);
		setCode('');
		setMessageContent(null);
		setSaveError(null);
		setTreeFocusPath(null);
	}, [flushCurrentFile]);

	// Open the string editor modal for the string at the current cursor position
	const openStringEditor = useCallback(() => {
		if (readOnly) return false;

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
	}, [readOnly]);

	// Handle saving from the string editor modal
	const handleStringEditorSave = useCallback(
		(newValue: string) => {
			if (readOnly) return;

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
		[readOnly, stringEditorState.contentStart, stringEditorState.contentEnd]
	);

	const closeStringEditor = useCallback(() => {
		setStringEditorState((prev) => ({ ...prev, isOpen: false }));
		// Refocus the main editor
		setTimeout(() => editorRef.current?.focus(), 0);
	}, []);

	const handleShowMessage = useCallback(
		async (_path: string | null, message: string | JSX.Element) => {
			const actionId = ++editorActionIdRef.current;
			await flushCurrentFile();
			if (editorActionIdRef.current !== actionId) {
				return false;
			}
			currentPathRef.current = null;
			setCurrentPath(null);

			if (typeof message === 'string') {
				codeRef.current = message;
				setCode(message);
				setMessageContent(null);
			} else {
				codeRef.current = '';
				setCode('');
				setMessageContent(message);
			}

			setSaveError(null);
			setShowExplorerOnMobile(false);
			setTreeFocusPath(null);
			return true;
		},
		[flushCurrentFile]
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
			...(readOnly
				? []
				: [
						keymap.of([
							{
								key: 'Mod-e',
								preventDefault: true,
								run: () => openStringEditor(),
							},
						]),
						createStringEditorTooltip(openStringEditor),
					]),
		],
		[handleValidationChange, openStringEditor, readOnly]
	);

	const handleDownloadBundle = useCallback(async () => {
		try {
			await flushCurrentFile();
			const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
			const addEntries = async (dirPath: string, prefix: string) => {
				const entries = await filesystem.listFiles(dirPath);
				for (const name of entries) {
					const absPath = joinPaths(dirPath, name);
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
	}, [filesystem, flushCurrentFile]);

	const showTemporarySuccessMessage = (message: string) => {
		setSuccessMessage(message);
		if (successMessageTimerRef.current !== undefined) {
			window.clearTimeout(successMessageTimerRef.current);
		}
		successMessageTimerRef.current = window.setTimeout(() => {
			setSuccessMessage(null);
			successMessageTimerRef.current = undefined;
		}, 2000);
	};

	const handleShareBlueprint = async () => {
		if (!currentBlueprintShareUrl) {
			setSaveError(
				copyBlueprintUrlDisabledReason ??
					'Could not copy a Blueprint URL.'
			);
			return;
		}
		try {
			await navigator.clipboard.writeText(currentBlueprintShareUrl);

			setSaveError(null);
			showTemporarySuccessMessage('Link copied to clipboard!');
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
			triggerRecreate: handleRecreateFromBlueprint,
		}),
		[handleDownloadBundle, filesystem, handleRecreateFromBlueprint]
	);

	const isAutosaved = site ? isAutosavedSite(site) : false;
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
							<div className={styles.editorHeaderActions}>
								<a
									className={styles.editorDocsLink}
									href="https://wordpress.github.io/wordpress-playground/blueprints"
									target="_blank"
									rel="noreferrer"
									aria-label="What are Blueprints? Open the documentation"
									title="What are Blueprints? Open the documentation"
								>
									<Icon icon={help} size={24} />
								</a>
								<Dropdown
									className={styles.editorExport}
									popoverProps={{ placement: 'bottom-end' }}
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
											<Icon
												icon={chevronDown}
												size={20}
											/>
										</Button>
									)}
									renderContent={({ onClose }) => (
										<>
											<MenuGroup>
												<MenuItem
													icon={link}
													disabled={
														!currentBlueprintShareUrl
													}
													onClick={() => {
														handleShareBlueprint();
														onClose();
													}}
												>
													Copy Blueprint URL
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
											{/* Say why Copy Blueprint URL is greyed
											    out, as a quiet footnote under the menu
											    rather than crowding the item itself. */}
											{copyBlueprintUrlDisabledReason && (
												<p
													className={
														styles.exportHint
													}
												>
													{
														copyBlueprintUrlDisabledReason
													}
												</p>
											)}
										</>
									)}
								/>
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
										{isAutosaved
											? 'Run Blueprint and reset site'
											: 'Run Blueprint'}
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

function createEditedBundleSetupUrlFingerprintSource(
	siteSlug: string,
	recreatedAt: number
) {
	const url = new URL(window.location.href);
	url.search = '';
	// A Blueprint bundle edited in OPFS may contain files that no URL can
	// recreate. Give that autosave a non-route hash so it never matches an
	// unrelated setup URL such as a clean default Playground.
	url.hash = `opfs-blueprint-${siteSlug}-${recreatedAt}`;
	return url;
}
