import {
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
	const cacheKey = filePath;
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

export type CodeEditorProps = {
	code: string;
	onChange: (next: string) => void;
	currentPath: string | null;
	className?: string;
	onSaveShortcut?: () => void;
	readOnly?: boolean;
};

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
	function CodeEditor(
		{
			code,
			onChange,
			currentPath,
			className,
			onSaveShortcut,
			readOnly = false,
		},
		ref
	) {
		const editorRootRef = useRef<HTMLDivElement | null>(
			null
		) as MutableRefObject<HTMLDivElement | null>;
		const viewRef = useRef<EditorView | null>(null);
		const languageCompartmentRef = useRef(new Compartment());
		const editableCompartmentRef = useRef(new Compartment());
		const latestCodeRef = useRef(code);
		const shouldRestoreFocusRef = useRef(false);

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
			if (viewRef.current) {
				return;
			}
			const container = editorRootRef.current;
			if (!container) {
				return;
			}

			const state = EditorState.create({
				doc: code,
				extensions: [
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
					history(),
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
						onChange(nextDoc);
					}),
					keymap.of([
						{
							key: 'Mod-s',
							preventDefault: true,
							run: () => {
								onSaveShortcut?.();
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

			const view = new EditorView({ state, parent: container });
			viewRef.current = view;

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
			const currentDoc = view.state.doc.toString();
			if (code === currentDoc) {
				return;
			}
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: code },
			});
		}, [code]);

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
			if (shouldRestoreFocusRef.current && !view.hasFocus) {
				view.focus();
				shouldRestoreFocusRef.current = false;
			}
		}, [currentPath, readOnly]);

		return <div ref={editorRootRef} className={className} />;
	}
);

CodeEditor.displayName = 'CodeEditor';
