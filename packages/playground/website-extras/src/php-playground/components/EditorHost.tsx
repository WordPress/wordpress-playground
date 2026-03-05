import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
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

import { useAppDispatch, useAppSelector } from '../hooks';
import { queueRun, setCode } from '../store';
import styles from './Layout.module.css';

// Language detection function based on file extension
const getLanguageExtension = (filePath: string | null) => {
	if (!filePath) {
		return php(); // Default to PHP
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
				jsx: true,
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

export type EditorHostHandle = {
	focus: () => void;
};

export const EditorHost = forwardRef<EditorHostHandle>((_, ref) => {
	const dispatch = useAppDispatch();
	const code = useAppSelector((state) => state.playground.code);
	// @TODO: tricky – the parent may be renamed, moved, etc. Make
	//        sure this stays up to date! Never save changes to an
	//        outdated path!
	const currentPath = useAppSelector((state) => state.playground.currentPath);
	const client = useAppSelector((state) => state.playground.client);
	const editorRef = useRef<HTMLDivElement | null>(null);
	const viewRef = useRef<EditorView | null>(null);
	const languageCompartmentRef = useRef(new Compartment());
	const saveTimeoutRef = useRef<number | null>(null);

	useImperativeHandle(ref, () => ({
		focus: () => {
			viewRef.current?.focus();
		},
	}));

	useEffect(() => {
		if (viewRef.current) {
			return;
		}
		const container = editorRef.current;
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
					dispatch(setCode(nextDoc));
				}),
				keymap.of([
					{
						key: 'Mod-s',
						preventDefault: true,
						run: () => {
							dispatch(queueRun());
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
		// The editor instance should persist across renders. Recreate it only once.
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

	// Update language highlighting when currentPath changes
	useEffect(() => {
		const view = viewRef.current;
		if (!view) {
			return;
		}

		const newLanguageExtension = getLanguageExtension(currentPath);
		view.dispatch({
			effects:
				languageCompartmentRef.current.reconfigure(
					newLanguageExtension
				),
		});
	}, [currentPath]);

	// Debounced save of editor contents to the currently selected file
	useEffect(() => {
		if (!client || !currentPath) {
			return;
		}
		if (saveTimeoutRef.current) {
			window.clearTimeout(saveTimeoutRef.current);
		}
		saveTimeoutRef.current = window.setTimeout(() => {
			// Best-effort save; ignore errors (e.g., read-only files)
			client
				.writeFile(currentPath, code)
				.catch(() => {})
				.finally(() => {
					/* noop */
				});
		}, 500);
		return () => {
			if (saveTimeoutRef.current) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
		};
	}, [client, currentPath, code]);

	return <div id="editor" ref={editorRef} className={styles.editor} />;
});

EditorHost.displayName = 'EditorHost';
