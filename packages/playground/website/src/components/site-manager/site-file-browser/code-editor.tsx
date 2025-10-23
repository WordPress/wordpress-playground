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
} from '@codemirror/view';
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
} from '@codemirror/language';
import { php } from '@codemirror/lang-php';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';

const getLanguageExtension = (filePath: string | null) => {
	if (!filePath) {
		return php();
	}

	const extension = filePath.split('.').pop()?.toLowerCase();

	switch (extension) {
		case 'css':
			return css();
		case 'js':
		case 'jsx':
		case 'ts':
		case 'tsx':
			return javascript({
				jsx: extension === 'jsx' || extension === 'tsx',
				typescript: extension === 'ts' || extension === 'tsx',
			});
		case 'json':
			return json();
		case 'html':
		case 'htm':
			return html();
		case 'md':
		case 'markdown':
			return markdown();
		case 'php':
		default:
			return php();
	}
};

export type CodeEditorHandle = {
	focus: () => void;
};

export type CodeEditorProps = {
	code: string;
	onChange: (next: string) => void;
	currentPath: string | null;
	className?: string;
	onSaveShortcut?: () => void;
	readOnly?: boolean;
	containerRef?: MutableRefObject<HTMLDivElement | null>;
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
			containerRef,
		},
		ref
	) {
		const editorRootRef =
			containerRef ??
			(useRef<HTMLDivElement | null>(
				null
			) as MutableRefObject<HTMLDivElement | null>);
		const viewRef = useRef<EditorView | null>(null);
		const languageCompartmentRef = useRef(new Compartment());
		const editableCompartmentRef = useRef(new Compartment());
		const latestCodeRef = useRef(code);
		const shouldRestoreFocusRef = useRef(false);

		useImperativeHandle(ref, () => ({
			focus: () => {
				viewRef.current?.focus();
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
					languageCompartmentRef.current.of(
						getLanguageExtension(currentPath)
					),
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
			const languageExtension = getLanguageExtension(currentPath);
			view.dispatch({
				effects:
					languageCompartmentRef.current.reconfigure(
						languageExtension
					),
			});
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
