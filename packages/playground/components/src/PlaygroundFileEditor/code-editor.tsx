import React, {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	type MutableRefObject,
} from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import {
	EditorView,
	keymap,
	lineNumbers,
	highlightActiveLine,
	highlightActiveLineGutter,
	dropCursor,
	rectangularSelection,
	crosshairCursor,
	ViewPlugin,
	type PluginValue,
	type EditorView as EditorViewType,
} from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
	autocompletion,
	completionKeymap,
	closeBrackets,
	closeBracketsKeymap,
} from '@codemirror/autocomplete';
import {
	foldGutter,
	indentOnInput,
	bracketMatching,
	foldKeymap,
	syntaxHighlighting,
	defaultHighlightStyle,
	type LanguageSupport,
} from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { php } from '@codemirror/lang-php';

/**
 * Async language loaders.
 *
 * Language extensions can be heavy, so we only load the PHP extension
 * optimistically. The other extensions are only loaded once the user opens a
 * file with a relevant extension. The content of the file shows up in the
 * code editor immediately without any highlighting, and then, once the extension
 * is loaded, the highlighting is applied.
 */
const languageExtensionCache = new Map<string, LanguageSupport>();

const loadLanguageExtension = async (
	filePath: string | null
): Promise<LanguageSupport> => {
	if (!filePath) {
		return php();
	}

	const extension = filePath.split('.').pop()?.toLowerCase();

	if (!extension || extension === 'php') {
		return php();
	}

	// Check cache first
	const cacheKey = extension;
	if (languageExtensionCache.has(cacheKey)) {
		return languageExtensionCache.get(cacheKey)!;
	}

	// Load the appropriate extension
	let langSupport: LanguageSupport;

	switch (extension) {
		case 'css':
			langSupport = await import('@codemirror/lang-css').then((m) =>
				m.css()
			);
			break;
		case 'js':
		case 'jsx':
		case 'ts':
		case 'tsx':
			langSupport = await import('@codemirror/lang-javascript').then(
				(m) =>
					m.javascript({
						jsx: extension === 'jsx' || extension === 'tsx',
						typescript: extension === 'ts' || extension === 'tsx',
					})
			);
			break;
		case 'json':
			langSupport = await import('@codemirror/lang-json').then((m) =>
				m.json()
			);
			break;
		case 'html':
		case 'htm':
			langSupport = await import('@codemirror/lang-html').then((m) =>
				m.html()
			);
			break;
		case 'md':
		case 'markdown':
			langSupport = await import('@codemirror/lang-markdown').then((m) =>
				m.markdown()
			);
			break;
		default:
			langSupport = php();
	}

	// Cache it
	languageExtensionCache.set(cacheKey, langSupport);
	return langSupport;
};

// Plugin to handle clicks below the content and move cursor to end of document
class ClickBelowContentHandler implements PluginValue {
	private view: EditorViewType;

	constructor(view: EditorViewType) {
		this.view = view;
		this.handleClick = this.handleClick.bind(this);
		this.view.dom.addEventListener('mousedown', this.handleClick);
	}

	handleClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		// Check if click is on the editor scroller or content area (empty space below text)
		if (
			target.classList.contains('cm-scroller') ||
			target.classList.contains('cm-content')
		) {
			const pos = this.view.posAtCoords({
				x: event.clientX,
				y: event.clientY,
			});

			// If pos is null, we clicked below all content
			// OR if we're at the document end, move cursor there
			if (pos === null) {
				const lastPos = this.view.state.doc.length;
				const selection = EditorSelection.create([
					EditorSelection.range(lastPos, lastPos),
				]);
				this.view.dispatch({
					selection,
					effects: EditorView.scrollIntoView(lastPos, {
						y: 'center',
					}),
				});
				this.view.focus();
				event.preventDefault();
			}
		}
	}

	destroy() {
		this.view.dom.removeEventListener('mousedown', this.handleClick);
	}
}

const clickBelowContentExtension = ViewPlugin.define(
	(view) => new ClickBelowContentHandler(view)
);

export type CodeEditorHandle = {
	focus: () => void;
	blur: () => void;
	getCursorPosition: () => number | null;
	setCursorPosition: (pos: number) => void;
};

/**
 * Describes one document activation. A new revision starts a fresh undo
 * history and applies its cursor position atomically with the document update.
 */
export type CodeEditorCursorRestoreRequest = {
	revision: number;
	position: number;
};

export type CodeEditorProps = {
	code: string;
	onChange: (next: string) => void;
	currentPath: string | null;
	/** Activates a document revision with a fresh history and restored cursor. */
	cursorRestore?: CodeEditorCursorRestoreRequest;
	/** Reports when CodeMirror has applied a requested document and cursor revision. */
	onCursorRestoreApplied?: (revision: number) => void;
	className?: string;
	onSaveShortcut?: () => void;
	readOnly?: boolean;
	additionalExtensions?: Extension[];
};

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
	function CodeEditor(
		{
			code,
			onChange,
			currentPath,
			cursorRestore,
			onCursorRestoreApplied,
			className,
			onSaveShortcut,
			readOnly = false,
			additionalExtensions,
		},
		ref
	) {
		const editorRootRef = useRef<HTMLDivElement | null>(
			null
		) as MutableRefObject<HTMLDivElement | null>;
		const viewRef = useRef<EditorView | null>(null);
		const languageCompartmentRef = useRef(new Compartment());
		const editableCompartmentRef = useRef(new Compartment());
		const extraCompartmentRef = useRef(new Compartment());
		const historyCompartmentRef = useRef(new Compartment());
		const latestCodeRef = useRef(code);
		const onChangeRef = useRef(onChange);
		const onSaveShortcutRef = useRef(onSaveShortcut);
		const shouldRestoreFocusRef = useRef(false);
		const appliedCursorRestoreRevisionRef = useRef<number | null>(null);

		useImperativeHandle(ref, () => ({
			focus: () => {
				viewRef.current?.focus();
			},
			blur: () => {
				const view = viewRef.current;
				if (view) {
					(view.contentDOM as HTMLElement).blur();
				}
			},
			getCursorPosition: () => {
				if (!viewRef.current) {
					return null;
				}
				return viewRef.current.state.selection.main.anchor;
			},
			setCursorPosition: (pos: number) => {
				if (!viewRef.current) {
					return;
				}
				const clampedPos = Math.min(
					pos,
					viewRef.current.state.doc.length
				);
				const selection = EditorSelection.create([
					EditorSelection.range(clampedPos, clampedPos),
				]);
				viewRef.current.dispatch({
					selection,
					scrollIntoView: true,
				});
			},
		}));

		useEffect(() => {
			latestCodeRef.current = code;
		}, [code]);

		useEffect(() => {
			onChangeRef.current = onChange;
		}, [onChange]);

		useEffect(() => {
			onSaveShortcutRef.current = onSaveShortcut;
		}, [onSaveShortcut]);

		useEffect(() => {
			if (viewRef.current) {
				return;
			}
			const container = editorRootRef.current;
			if (!container) {
				return;
			}

			const state = EditorState.create({
				doc: code,
				selection: cursorRestore
					? EditorSelection.cursor(
							Math.max(
								0,
								Math.min(cursorRestore.position, code.length)
							)
						)
					: undefined,
				extensions: [
					extraCompartmentRef.current.of(additionalExtensions ?? []),
					lineNumbers(),
					highlightActiveLineGutter(),
					highlightActiveLine(),
					foldGutter(),
					dropCursor(),
					rectangularSelection(),
					crosshairCursor(),
					clickBelowContentExtension,
					languageCompartmentRef.current.of(php()),
					editableCompartmentRef.current.of(
						EditorView.editable.of(!readOnly)
					),
					syntaxHighlighting(defaultHighlightStyle),
					indentOnInput(),
					bracketMatching(),
					closeBrackets(),
					historyCompartmentRef.current.of(history()),
					highlightSelectionMatches(),
					autocompletion(),
					EditorView.updateListener.of((update) => {
						if (!update.docChanged) {
							return;
						}
						const nextDoc = update.state.doc.toString();
						if (nextDoc === latestCodeRef.current) {
							return;
						}
						latestCodeRef.current = nextDoc;
						onChangeRef.current(nextDoc);
					}),
					keymap.of([
						{
							key: 'Mod-s',
							preventDefault: true,
							run: () => {
								onSaveShortcutRef.current?.();
								return true;
							},
						},
						...closeBracketsKeymap,
						...completionKeymap,
						...foldKeymap,
						...searchKeymap,
						...historyKeymap,
						...defaultKeymap,
						indentWithTab,
					]),
				],
			});
			if (cursorRestore) {
				appliedCursorRestoreRevisionRef.current =
					cursorRestore.revision;
			}

			const view = new EditorView({ state, parent: container });
			viewRef.current = view;
			if (cursorRestore) {
				onCursorRestoreApplied?.(cursorRestore.revision);
			}

			return () => {
				view.destroy();
				viewRef.current = null;
			};
			// The editor instance should be created only once.
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, []);

		useEffect(() => {
			const view = viewRef.current;
			if (!view) {
				return;
			}
			view.dispatch({
				effects: extraCompartmentRef.current.reconfigure(
					additionalExtensions ?? []
				),
			});
		}, [additionalExtensions]);

		useLayoutEffect(() => {
			const view = viewRef.current;
			if (!view) {
				return;
			}
			const currentDoc = view.state.doc.toString();
			const shouldRestoreCursor =
				cursorRestore !== undefined &&
				appliedCursorRestoreRevisionRef.current !==
					cursorRestore.revision;
			if (code === currentDoc && !shouldRestoreCursor) {
				return;
			}
			latestCodeRef.current = code;
			if (shouldRestoreCursor) {
				appliedCursorRestoreRevisionRef.current =
					cursorRestore.revision;
				// Remove the state field before replacing the document. Re-adding it
				// after the replacement creates an empty history for this file, so
				// undo can never replay changes made in the previously open file.
				view.dispatch({
					effects: historyCompartmentRef.current.reconfigure([]),
				});
			}
			view.dispatch({
				changes:
					code === currentDoc
						? undefined
						: {
								from: 0,
								to: view.state.doc.length,
								insert: code,
							},
				selection: shouldRestoreCursor
					? EditorSelection.cursor(
							Math.max(
								0,
								Math.min(cursorRestore.position, code.length)
							)
						)
					: undefined,
				scrollIntoView: shouldRestoreCursor,
			});
			if (shouldRestoreCursor) {
				view.dispatch({
					effects:
						historyCompartmentRef.current.reconfigure(history()),
				});
				onCursorRestoreApplied?.(cursorRestore.revision);
			}
		}, [code, cursorRestore, onCursorRestoreApplied]);

		useEffect(() => {
			const view = viewRef.current;
			if (!view) {
				return;
			}

			// Check if it's a PHP file
			const extension = currentPath?.split('.').pop()?.toLowerCase();
			const isPhpFile = !extension || extension === 'php';

			// For PHP files, apply PHP syntax immediately (non-blocking)
			// For other files, start with no extension and let async loading handle it
			if (isPhpFile) {
				view.dispatch({
					effects: languageCompartmentRef.current.reconfigure(php()),
				});
			}

			// Then load the correct extension asynchronously
			let cancelled = false;
			void loadLanguageExtension(currentPath).then((langSupport) => {
				if (cancelled || !viewRef.current) {
					return;
				}
				viewRef.current.dispatch({
					effects:
						languageCompartmentRef.current.reconfigure(langSupport),
				});
			});

			return () => {
				cancelled = true;
			};
		}, [currentPath]);

		useEffect(() => {
			const view = viewRef.current;
			if (!view) {
				return;
			}
			// Save focus state before reconfiguring editable
			if (view.hasFocus) {
				shouldRestoreFocusRef.current = true;
			}
			view.dispatch({
				effects: editableCompartmentRef.current.reconfigure(
					EditorView.editable.of(!readOnly)
				),
			});
		}, [readOnly]);

		useLayoutEffect(() => {
			const view = viewRef.current;
			if (!view) {
				return;
			}
			if (!shouldRestoreFocusRef.current) {
				return;
			}
			shouldRestoreFocusRef.current = false;
			if (!view.hasFocus) {
				view.focus();
			}
		}, [currentPath, readOnly]);

		return <div ref={editorRootRef} className={className} />;
	}
);

CodeEditor.displayName = 'CodeEditor';
