import { autocompletion } from '@codemirror/autocomplete';
import { StateField, type Extension } from '@codemirror/state';
import {
	EditorView,
	keymap,
	showTooltip,
	type Tooltip,
} from '@codemirror/view';
import { logger } from '@php-wasm/logger';
import { dirname } from '@php-wasm/util';
import { Button, Icon, Notice } from '@wordpress/components';
import { download, link } from '@wordpress/icons';
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
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	CodeEditor,
	drainFilesystemOperations,
	FileExplorerSidebar,
	type CodeEditorCursorRestoreRequest,
	type CodeEditorHandle,
	type FileOpenRequestGuard,
	type FilePickerPathChangeOutcome,
	pathContainsPath,
	remapPathAfterMove,
	serializeFilesystemOperation,
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
import { getBlueprintFilesystemIdentity } from './blueprint-filesystem-identity';
import { useBlueprintUrlHash } from '../../lib/hooks/use-blueprint-url-hash';
import {
	removeClientInfo,
	selectClientInfoBySiteSlug,
} from '../../lib/state/redux/slice-clients';
import {
	isAutosavedSite,
	replaceAutosavedSiteSetup,
	replaceTemporarySiteSetup,
	type SiteInfo,
} from '../../lib/state/redux/slice-sites';
import { useAppDispatch } from '../../lib/state/redux/store';
import {
	abortSiteBoot,
	getCurrentSiteBootSignal,
	suspendCurrentSiteRuntime,
} from '../../lib/state/site-runtime-lock';
import { registerBlueprintFilesystemFlusher } from '../../lib/state/blueprint-filesystem-write-coordinator';
import styles from './blueprint-bundle-editor.module.css';
import hideRootStyles from './hide-root.module.css';
import validationStyles from './validation-panel.module.css';
import type { EventedFilesystem } from '@wp-playground/storage';

const BLUEPRINT_JSON_PATH = '/blueprint.json';
const BLUEPRINT_SAVE_DEBOUNCE_MS = 200;

type BlueprintWriteQueue = {
	pending: Promise<void>;
	pendingPathChanges: Promise<void>;
	failure?: {
		path: string;
		content: string;
	};
};

type PendingBlueprintPathChange = {
	path: string;
	affectsCurrentFile: boolean;
	settled: Promise<void>;
	settle: () => void;
};

const blueprintWriteQueues = new WeakMap<
	AsyncWritableFilesystem,
	BlueprintWriteQueue
>();

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
	/** Returns the flushed bundle, or null when the active buffer cannot be saved. */
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
	const [cursorRestore, setCursorRestore] =
		useState<CodeEditorCursorRestoreRequest>();
	const [saveError, setSaveError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [showExplorerOnMobile, setShowExplorerOnMobile] =
		useState<boolean>(false);
	const [messageContent, setMessageContent] = useState<
		string | JSX.Element | null
	>(null);
	const [displayPath, setDisplayPath] = useState<string | null>(null);
	const [isRecreating, setIsRecreating] = useState(false);
	const [isPathMutationInProgress, setIsPathMutationInProgress] =
		useState(false);
	const [isCurrentPathMutation, setIsCurrentPathMutation] = useState(false);
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
	const filesystemRef = useRef(filesystem);
	const currentPathRef = useRef<string | null>(null);
	const codeRef = useRef('');
	const dirtyRef = useRef(false);
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const editorActionIdRef = useRef(0);
	const nextCursorRestoreRevisionRef = useRef(1);
	const pendingPathChangeRef = useRef<PendingBlueprintPathChange | null>(
		null
	);
	const mountedRef = useRef(true);
	const dispatch = useAppDispatch();

	/** Cancels the debounce timer without discarding the dirty buffer. */
	const clearScheduledSave = useCallback(() => {
		if (saveTimeoutRef.current !== null) {
			clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
	}, []);

	/**
	 * Writes the active buffer and any edits made while that write is in flight.
	 *
	 * File reads, path mutations, exports, and Playground recreation all await
	 * this function before they consume the Blueprint filesystem.
	 */
	const flushCurrentFile = useCallback(async () => {
		clearScheduledSave();
		const activeFilesystem = filesystemRef.current;

		try {
			await drainBlueprintWrites(activeFilesystem);
			await drainFilesystemOperations(activeFilesystem);
			if (filesystemRef.current !== activeFilesystem) {
				return true;
			}
			const pathToSave = currentPathRef.current;
			if (!dirtyRef.current || !pathToSave) {
				if (getBlueprintWriteQueue(activeFilesystem).failure) {
					if (mountedRef.current) {
						setSaveError(
							'Previous changes could not be saved. Open the recovered file and try again.'
						);
					}
					return false;
				}
				return true;
			}
			while (
				dirtyRef.current &&
				filesystemRef.current === activeFilesystem &&
				currentPathRef.current === pathToSave
			) {
				const contentToSave = codeRef.current;
				await queueBlueprintWrite(
					activeFilesystem,
					pathToSave,
					contentToSave
				);
				if (
					filesystemRef.current !== activeFilesystem ||
					currentPathRef.current !== pathToSave
				) {
					return true;
				}
				if (codeRef.current === contentToSave) {
					dirtyRef.current = false;
					if (getBlueprintWriteQueue(activeFilesystem).failure) {
						if (mountedRef.current) {
							setSaveError(
								'Previous changes could not be saved. Open the recovered file and try again.'
							);
						}
						return false;
					}
					if (mountedRef.current) {
						setSaveError(null);
					}
					return true;
				}
			}
			return true;
		} catch (error) {
			logger.error('Failed to save Blueprint file', error);
			if (mountedRef.current) {
				setSaveError('Could not save changes. Try again.');
			}
			return false;
		}
	}, [clearScheduledSave]);

	// Keep the coordinator registration alive until unmount's final write and
	// every older path mutation have settled. A storage transition can begin as
	// soon as this editor closes; removing the alias first would let its snapshot
	// pass the write that cleanup is about to enqueue.
	useEffect(() => {
		mountedRef.current = true;
		let unmounted = false;
		let unregister = () => {};
		/** Retries a failed final write and releases a detached registration. */
		const flushForCoordinator = async () => {
			const flushed = await flushCurrentFile();
			if (unmounted && flushed) {
				unregister();
			}
			return flushed;
		};
		unregister = registerBlueprintFilesystemFlusher(
			filesystem,
			flushForCoordinator
		);
		return () => {
			unmounted = true;
			mountedRef.current = false;
			clearScheduledSave();
			const activeFilesystem = filesystem;
			const path =
				filesystemRef.current === filesystem
					? currentPathRef.current
					: null;
			let finalWrite = Promise.resolve();
			if (
				dirtyRef.current &&
				path &&
				!pendingPathChangeRef.current?.affectsCurrentFile
			) {
				finalWrite = queueBlueprintWrite(
					activeFilesystem,
					path,
					codeRef.current
				).catch((error) => {
					logger.error(
						'Failed to save Blueprint file on unmount',
						error
					);
				});
			}
			void finalWrite
				.then(() => drainBlueprintWrites(activeFilesystem))
				.then(() => drainFilesystemOperations(activeFilesystem))
				.finally(() => {
					// Keep the detached flusher registered when the final buffer
					// failed. A later save can retry it; blindly unregistering here
					// would let that save snapshot stale backend contents.
					if (!getBlueprintWriteQueue(activeFilesystem).failure) {
						unregister();
					}
				});
		};
	}, [clearScheduledSave, filesystem, flushCurrentFile]);

	/** Debounces an ordinary edit unless a path mutation currently owns it. */
	const scheduleCurrentFileSave = useCallback(() => {
		clearScheduledSave();
		if (
			!dirtyRef.current ||
			!currentPathRef.current ||
			pendingPathChangeRef.current?.affectsCurrentFile
		) {
			return;
		}
		saveTimeoutRef.current = setTimeout(() => {
			saveTimeoutRef.current = null;
			void flushCurrentFile();
		}, BLUEPRINT_SAVE_DEBOUNCE_MS);
	}, [clearScheduledSave, flushCurrentFile]);

	/** Mirrors CodeMirror changes into the buffer owned by the active path. */
	const handleCodeChange = useCallback(
		(newCode: string) => {
			if (newCode === codeRef.current) {
				return;
			}
			codeRef.current = newCode;
			dirtyRef.current = true;
			setCode(newCode);
			scheduleCurrentFileSave();
		},
		[scheduleCurrentFileSave]
	);

	// The shell normally keeps one filesystem for this component's lifetime. If
	// that contract changes, capture the old dirty buffer before clearing the UI.
	useLayoutEffect(() => {
		const previousFilesystem = filesystemRef.current;
		if (previousFilesystem === filesystem) {
			return;
		}
		clearScheduledSave();
		const previousPath = currentPathRef.current;
		const previousCode = codeRef.current;
		const previousBufferWasDirty = dirtyRef.current;
		filesystemRef.current = filesystem;
		currentPathRef.current = null;
		codeRef.current = '';
		dirtyRef.current = false;
		pendingPathChangeRef.current = null;
		setCurrentPath(null);
		setCode('');
		setCursorRestore(undefined);
		setDisplayPath(null);
		setMessageContent(null);
		setIsPathMutationInProgress(false);
		setIsCurrentPathMutation(false);
		if (previousBufferWasDirty && previousPath) {
			void queueBlueprintWrite(
				previousFilesystem,
				previousPath,
				previousCode
			).catch((error) => {
				logger.error(
					'Failed to save Blueprint file before switching filesystems',
					error
				);
			});
		}
	}, [clearScheduledSave, filesystem]);

	// Load initial blueprint.json and focus tree
	useEffect(() => {
		let cancelled = false;
		const actionId = ++editorActionIdRef.current;
		(async () => {
			try {
				await drainBlueprintWrites(filesystem);
				const failedSnapshot =
					getBlueprintWriteQueue(filesystem).failure;
				if (
					cancelled ||
					filesystemRef.current !== filesystem ||
					editorActionIdRef.current !== actionId
				) {
					return;
				}
				if (failedSnapshot) {
					currentPathRef.current = failedSnapshot.path;
					codeRef.current = failedSnapshot.content;
					dirtyRef.current = true;
					setCursorRestore({
						revision: nextCursorRestoreRevisionRef.current++,
						position: 0,
					});
					setCurrentPath(failedSnapshot.path);
					setDisplayPath(failedSnapshot.path);
					setCode(failedSnapshot.content);
					setSaveError(
						'Previous changes were not saved. They remain open so you can retry.'
					);
					setMessageContent(null);
					setShowExplorerOnMobile(false);
					return;
				}
				const blueprintJsonContent = await serializeFilesystemOperation(
					filesystem,
					() => filesystem.readFileAsText(BLUEPRINT_JSON_PATH)
				);
				if (
					cancelled ||
					filesystemRef.current !== filesystem ||
					editorActionIdRef.current !== actionId
				) {
					return;
				}
				currentPathRef.current = BLUEPRINT_JSON_PATH;
				codeRef.current = blueprintJsonContent;
				dirtyRef.current = false;
				setCursorRestore({
					revision: nextCursorRestoreRevisionRef.current++,
					position: 0,
				});
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

	const handleRecreateFromBlueprint = useCallback(async () => {
		if (
			!site ||
			readOnly ||
			(site.metadata.storage !== 'none' && !isAutosavedSite(site))
		) {
			return;
		}
		if (pendingPathChangeRef.current) {
			setSaveError(
				'Wait for the file operation to finish, then try again.'
			);
			return;
		}
		try {
			setIsRecreating(true);
			setSaveError(null);
			if (!(await flushCurrentFile())) {
				return;
			}
			const isAutosaved = isAutosavedSite(site);
			const bundle =
				(filesystem as EventedFilesystem | null) ??
				((site.metadata.originalBlueprint ||
					null) as EventedFilesystem | null);
			if (!bundle) {
				throw new Error('Blueprint bundle is not available.');
			}
			const runtimeConfiguration = await serializeFilesystemOperation(
				filesystem,
				() => resolveRuntimeConfiguration(bundle as any)
			);
			const changes = {
				...(isAutosaved ? { loadedFromStorage: false } : {}),
				metadata: {
					originalBlueprintSource: isAutosaved
						? site.metadata.originalBlueprintSource?.type ===
							'opfs-site'
							? site.metadata.originalBlueprintSource
							: { type: 'opfs-site' as const }
						: { type: 'none' as const },
					originalBlueprint: isAutosaved
						? (filesystem as EventedFilesystem).backend
						: bundle,
					runtimeConfiguration,
					initialOpfsSyncPending:
						isAutosaved || site.metadata.initialOpfsSyncPending,
					/**
					 * Recreating an autosaved Playground discards the old
					 * WordPress files and boots from the edited Blueprint.
					 * Constants discovered from the previous runtime may no
					 * longer exist in the recreated site, so they must be
					 * rediscovered after the first OPFS sync.
					 */
					playgroundDefinedConstants: isAutosaved
						? undefined
						: site.metadata.playgroundDefinedConstants,
					whenCreated: Date.now(),
				},
				originalUrlParams: undefined,
			};
			if (isAutosaved) {
				// Bundle promotion and setup replacement share one site queue.
				// That queue also applies the crash-safe WordPress file deletion,
				// so a stale editor cannot tear down this client or write its
				// bundle over the current setup.
				const replacedCurrentSetup = await dispatch(
					replaceAutosavedSiteSetup({
						slug: site.slug,
						expectedSetup: {
							id: site.metadata.id,
							whenCreated: site.metadata.whenCreated,
							runtimeConfiguration:
								site.metadata.runtimeConfiguration,
							sourceSetupUrlFingerprint:
								site.metadata.sourceSetupUrlFingerprint,
						},
						changes,
						prepareForWordPressFileReset: () =>
							dispatch(async (innerDispatch, getState) => {
								const currentClientInfo =
									selectClientInfoBySiteSlug(
										getState(),
										site.slug
									);
								if (
									!currentClientInfo?.client ||
									!currentClientInfo.opfsMountDescriptor
								) {
									if (!getCurrentSiteBootSignal(site.slug)) {
										return undefined;
									}
									throw new Error(
										'Wait for the Playground to finish loading before resetting it.'
									);
								}
								return suspendCurrentSiteRuntime({
									siteSlug: site.slug,
									playground: currentClientInfo.client,
									mountDescriptor:
										currentClientInfo.opfsMountDescriptor,
									onDiscard: () =>
										innerDispatch(
											removeClientInfo(site.slug)
										),
								});
							}),
					})
				);
				if (!replacedCurrentSetup) {
					throw new Error(
						'The Playground setup changed before it ran.'
					);
				}
			} else {
				const replacedCurrentSetup = await dispatch(
					replaceTemporarySiteSetup({
						slug: site.slug,
						expectedSetup: {
							id: site.metadata.id,
							whenCreated: site.metadata.whenCreated,
							runtimeConfiguration:
								site.metadata.runtimeConfiguration,
							sourceSetupUrlFingerprint:
								site.metadata.sourceSetupUrlFingerprint,
						},
						changes,
						prepareForSetupReplacement: () => {
							abortSiteBoot(site.slug);
							dispatch(removeClientInfo(site.slug));
						},
					})
				);
				if (!replacedCurrentSetup) {
					throw new Error(
						'The Playground setup changed before it ran.'
					);
				}
			}
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

	/** Ensures a file read observes every edit from this and previous mounts. */
	const handleBeforeFileRead = useCallback(async () => {
		if (pendingPathChangeRef.current) {
			throw new Error('A Blueprint path mutation is still in progress');
		}
		if (!(await flushCurrentFile())) {
			throw new Error(
				'Could not save the active Blueprint file before reading'
			);
		}
		await drainBlueprintWrites(filesystemRef.current);
		await drainFilesystemOperations(filesystemRef.current);
	}, [flushCurrentFile]);

	/** Flushes the outgoing file before decoded contents replace the editor. */
	const handleFileOpened = useCallback(
		async (
			path: string,
			content: string,
			shouldFocus = true,
			isCurrentRequest?: FileOpenRequestGuard
		) => {
			if (pendingPathChangeRef.current) {
				return;
			}
			const actionId = ++editorActionIdRef.current;
			if (!(await flushCurrentFile())) {
				return;
			}
			if (
				pendingPathChangeRef.current ||
				editorActionIdRef.current !== actionId ||
				(isCurrentRequest && !isCurrentRequest())
			) {
				return;
			}
			if (path === currentPathRef.current) {
				setDisplayPath(path);
				setMessageContent(null);
				setSaveError(null);
				setShowExplorerOnMobile(false);
				if (shouldFocus) {
					setTimeout(() => {
						if (
							editorActionIdRef.current === actionId &&
							currentPathRef.current === path
						) {
							editorRef.current?.focus();
						}
					}, 20);
				}
				return;
			}

			const previousPath = currentPathRef.current;
			currentPathRef.current = path;
			codeRef.current = content;
			dirtyRef.current = false;
			if (previousPath !== path) {
				setCursorRestore({
					revision: nextCursorRestoreRevisionRef.current++,
					position: 0,
				});
			}
			setCurrentPath(path);
			setCode(content);
			setDisplayPath(path);
			setMessageContent(null);
			setSaveError(null);
			setShowExplorerOnMobile(false);

			if (shouldFocus) {
				setTimeout(() => {
					if (
						editorActionIdRef.current === actionId &&
						currentPathRef.current === path
					) {
						editorRef.current?.focus();
					}
				}, 20);
			}
		},
		[flushCurrentFile]
	);

	/** Clears the editor only after its final dirty snapshot reaches disk. */
	const handleClearSelection = useCallback(async () => {
		if (pendingPathChangeRef.current) {
			return;
		}
		const actionId = ++editorActionIdRef.current;
		if (!(await flushCurrentFile())) {
			return;
		}
		if (
			pendingPathChangeRef.current ||
			editorActionIdRef.current !== actionId
		) {
			return;
		}
		currentPathRef.current = null;
		codeRef.current = '';
		dirtyRef.current = false;
		setCursorRestore(undefined);
		setCurrentPath(null);
		setCode('');
		setMessageContent(null);
		setDisplayPath(null);
		setSaveError(null);
	}, [flushCurrentFile]);

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
		async (
			path: string | null,
			message: string | JSX.Element,
			isCurrentRequest?: FileOpenRequestGuard
		) => {
			if (pendingPathChangeRef.current) {
				return;
			}
			const actionId = ++editorActionIdRef.current;
			if (!(await flushCurrentFile())) {
				return;
			}
			if (
				pendingPathChangeRef.current ||
				editorActionIdRef.current !== actionId ||
				(isCurrentRequest && !isCurrentRequest())
			) {
				return;
			}
			currentPathRef.current = null;
			dirtyRef.current = false;
			setCursorRestore({
				revision: nextCursorRestoreRevisionRef.current++,
				position: 0,
			});
			setCurrentPath(null);
			setDisplayPath((prev) => path ?? prev);

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
		},
		[flushCurrentFile]
	);

	/** Freezes the active buffer before a tree mutation can move or delete it. */
	const handleBeforePathChange = useCallback(
		async (path: string) => {
			if (pendingPathChangeRef.current) {
				return false;
			}
			const affectsCurrentFile = pathContainsPath(
				path,
				currentPathRef.current
			);
			// The same promise blocks writes and imperative bundle reads. Completion
			// settles it only after queuing any final dirty snapshot; a veto settles it
			// here because FilePickerTree will not send a completion callback.
			/** Releases writes queued behind this approved path mutation. */
			let settlePathChange = () => {};
			const settled = new Promise<void>((resolve) => {
				settlePathChange = resolve;
			});
			const pendingPathChange: PendingBlueprintPathChange = {
				path,
				affectsCurrentFile,
				settled,
				settle: settlePathChange,
			};
			pendingPathChangeRef.current = pendingPathChange;
			setIsPathMutationInProgress(true);
			if (!affectsCurrentFile) {
				installBlueprintPathChangeBarrier(
					filesystemRef.current,
					pendingPathChange
				);
				return true;
			}
			setIsCurrentPathMutation(true);
			if (
				(await flushCurrentFile()) &&
				pendingPathChangeRef.current === pendingPathChange
			) {
				installBlueprintPathChangeBarrier(
					filesystemRef.current,
					pendingPathChange
				);
				return true;
			}
			pendingPathChange.settle();
			pendingPathChangeRef.current = null;
			setIsPathMutationInProgress(false);
			setIsCurrentPathMutation(false);
			return false;
		},
		[flushCurrentFile]
	);

	/** Remaps the live Blueprint paths after a file or directory move succeeds. */
	const handlePathMoved = useCallback((from: string, to: string) => {
		if (pendingPathChangeRef.current?.path !== from) {
			return;
		}
		const activePath = currentPathRef.current;
		const mappedActivePath = remapPathAfterMove(activePath, from, to);
		if (mappedActivePath !== activePath) {
			currentPathRef.current = mappedActivePath;
			setCurrentPath(mappedActivePath);
		}
		setDisplayPath((previous) => remapPathAfterMove(previous, from, to));
		setSelectedDirPath((previous) =>
			remapPathAfterMove(previous, from, to)
		);
	}, []);

	/** Clears editor state immediately after its active path is deleted. */
	const handlePathDeleted = useCallback(
		(path: string) => {
			if (pendingPathChangeRef.current?.path !== path) {
				return;
			}
			setSelectedDirPath((previous) =>
				pathContainsPath(path, previous) ? dirname(path) : previous
			);
			setDisplayPath((previous) =>
				pathContainsPath(path, previous) ? null : previous
			);
			if (!pathContainsPath(path, currentPathRef.current)) {
				return;
			}
			clearScheduledSave();
			editorActionIdRef.current += 1;
			currentPathRef.current = null;
			codeRef.current = '';
			dirtyRef.current = false;
			setCursorRestore(undefined);
			setCurrentPath(null);
			setCode('');
			setMessageContent(null);
			setSaveError(null);
		},
		[clearScheduledSave]
	);

	/** Releases the mutation lock and saves any dirty buffer that survived it. */
	const handlePathChangeComplete = useCallback(
		(path: string, outcome: FilePickerPathChangeOutcome) => {
			const pendingPathChange = pendingPathChangeRef.current;
			if (!pendingPathChange || pendingPathChange.path !== path) {
				return;
			}
			if (
				pendingPathChange.affectsCurrentFile &&
				outcome !== 'deleted' &&
				dirtyRef.current &&
				currentPathRef.current
			) {
				const activeFilesystem = filesystemRef.current;
				const activePath = currentPathRef.current;
				const content = codeRef.current;
				// Queue before releasing the path barrier so a replacement mount
				// cannot read between mv() and this final dirty snapshot.
				void queueBlueprintWrite(
					activeFilesystem,
					activePath,
					content
				).then(
					() => {
						if (
							filesystemRef.current === activeFilesystem &&
							currentPathRef.current === activePath &&
							codeRef.current === content
						) {
							dirtyRef.current = false;
							if (mountedRef.current) {
								setSaveError(null);
							}
						}
					},
					(error) => {
						logger.error(
							'Failed to save Blueprint file after a path change',
							error
						);
						if (mountedRef.current) {
							setSaveError('Could not save changes. Try again.');
						}
					}
				);
			}
			pendingPathChange.settle();
			pendingPathChangeRef.current = null;
			setIsPathMutationInProgress(false);
			if (pendingPathChange.affectsCurrentFile) {
				setIsCurrentPathMutation(false);
			}
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
			if (pendingPathChangeRef.current) {
				setSaveError(
					'Wait for the file operation to finish, then try again.'
				);
				return;
			}
			if (!(await flushCurrentFile())) {
				return;
			}
			const blob = await serializeFilesystemOperation(
				filesystem,
				async () => {
					const zipWriter = new ZipWriter(
						new BlobWriter('application/zip')
					);
					/** Adds one subtree while the exclusive ZIP snapshot lock is held. */
					const addEntries = async (
						dirPath: string,
						prefix: string
					) => {
						const entries = await filesystem.listFiles(dirPath);
						for (const name of entries) {
							const absPath =
								dirPath === '/'
									? `/${name}`
									: `${dirPath}/${name}`;
							const relative = prefix ? `${prefix}${name}` : name;
							if (await filesystem.isDir(absPath)) {
								await addEntries(
									absPath,
									relative.length ? `${relative}/` : ''
								);
							} else {
								const file = await filesystem.read(absPath);
								const buffer = new Uint8Array(
									await file.arrayBuffer()
								);
								await zipWriter.add(
									relative || name,
									new Uint8ArrayReader(buffer)
								);
							}
						}
					};
					await addEntries('/', '');
					return zipWriter.close();
				}
			);
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
			getBundle: async () => {
				while (pendingPathChangeRef.current) {
					await pendingPathChangeRef.current.settled;
				}
				if (!(await flushCurrentFile())) {
					return null;
				}
				await drainFilesystemOperations(filesystem);
				return filesystem;
			},
			triggerRecreate: handleRecreateFromBlueprint,
		}),
		[
			handleDownloadBundle,
			filesystem,
			flushCurrentFile,
			handleRecreateFromBlueprint,
		]
	);

	const isAutosaved = site ? isAutosavedSite(site) : false;
	const requestIdentity = site
		? getBlueprintFilesystemIdentity(site)
		: undefined;
	const disableRunButton =
		isRecreating ||
		isPathMutationInProgress ||
		!site ||
		hasValidationErrors;
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
							requestIdentity={requestIdentity}
							currentPath={currentPath}
							selectedDirPath={selectedDirPath}
							setSelectedDirPath={setSelectedDirPath}
							onFileOpened={handleFileOpened}
							onSelectionCleared={handleClearSelection}
							onBeforeFileRead={handleBeforeFileRead}
							onShowMessage={handleShowMessage}
							onBeforePathChange={handleBeforePathChange}
							onPathMoved={handlePathMoved}
							onPathDeleted={handlePathDeleted}
							onPathChangeComplete={handlePathChangeComplete}
							documentRoot="/"
							readOnly={readOnly || isRecreating}
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
									aria-label="Copy link to blueprint"
									disabled={!isBundleShareable}
								>
									<Icon icon={link} />
								</Button>
								<Button
									variant="tertiary"
									className={styles.editorToolbarButton}
									onClick={handleDownloadBundle}
									title="Download bundle"
									disabled={
										isPathMutationInProgress || isRecreating
									}
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
						{!readOnly && !isBundleShareable ? (
							<div style={{ padding: '8px 16px' }}>
								<Notice status="warning" isDismissible={false}>
									This Blueprint bundle contains multiple
									files and cannot be shared via URL. Use the
									download button to export the bundle as a
									zip file.
								</Notice>
							</div>
						) : null}
						{isAutosaved ? (
							<div style={{ padding: '8px 16px' }}>
								<Notice status="warning" isDismissible={false}>
									Running this Blueprint will recreate this
									autosaved Playground under the same name and
									replace all its files.
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
										cursorRestore={cursorRestore}
										onChange={handleCodeChange}
										currentPath={currentPath}
										className={styles.editor}
										readOnly={
											readOnly ||
											isRecreating ||
											isCurrentPathMutation ||
											!currentPath
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

/** Serializes one Blueprint write behind every older write to its filesystem. */
async function queueBlueprintWrite(
	filesystem: AsyncWritableFilesystem,
	path: string,
	content: string
) {
	const queue = getBlueprintWriteQueue(filesystem);
	const write = queue.pending.catch(() => undefined);
	const pathChanges = queue.pendingPathChanges.catch(() => undefined);
	const queuedWrite = Promise.all([write, pathChanges]).then(() =>
		serializeFilesystemOperation(filesystem, () =>
			filesystem.writeFile(path, content)
		)
	);
	queue.pending = queuedWrite.then(
		() => {
			if (queue.failure?.path === path) {
				queue.failure = undefined;
			}
		},
		() => {
			queue.failure = { path, content };
		}
	);
	await queuedWrite;
}

/** Returns the write queue shared by every mount of one Blueprint filesystem. */
function getBlueprintWriteQueue(filesystem: AsyncWritableFilesystem) {
	let queue = blueprintWriteQueues.get(filesystem);
	if (!queue) {
		queue = {
			pending: Promise.resolve(),
			pendingPathChanges: Promise.resolve(),
		};
		blueprintWriteQueues.set(filesystem, queue);
	}
	return queue;
}

/** Waits until a Blueprint filesystem has no editor writes or path barriers. */
async function drainBlueprintWrites(filesystem: AsyncWritableFilesystem) {
	const queue = getBlueprintWriteQueue(filesystem);
	while (true) {
		const pending = queue.pending;
		const pendingPathChanges = queue.pendingPathChanges;
		await Promise.all([pending, pendingPathChanges]);
		if (
			queue.pending === pending &&
			queue.pendingPathChanges === pendingPathChanges
		) {
			return;
		}
	}
}

/** Blocks later Blueprint writes until one approved path mutation settles. */
function installBlueprintPathChangeBarrier(
	filesystem: AsyncWritableFilesystem,
	pendingPathChange: PendingBlueprintPathChange
) {
	const queue = getBlueprintWriteQueue(filesystem);
	queue.pendingPathChanges = Promise.all([
		queue.pendingPathChanges.catch(() => undefined),
		pendingPathChange.settled,
	]).then(() => undefined);
}
