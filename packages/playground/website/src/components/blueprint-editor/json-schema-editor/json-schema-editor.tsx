import {
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	completionKeymap,
} from '@codemirror/autocomplete';
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import {
	bracketMatching,
	defaultHighlightStyle,
	foldGutter,
	foldKeymap,
	indentOnInput,
	indentUnit,
	syntaxHighlighting,
} from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
	crosshairCursor,
	dropCursor,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
	rectangularSelection,
	type ViewUpdate,
} from '@codemirror/view';
import { useEffect, useRef } from 'react';
import type { JSONSchemaCompletionConfig } from './types';
import { formatEditor, jsonSchemaCompletion } from './jsonSchemaCompletion';

interface JSONSchemaEditorProps {
	config?: JSONSchemaCompletionConfig;
	className?: string;
}
const DEFAULT_DOC = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json"
}`;

export function JSONSchemaEditor({
	config = {},
	className = '',
}: JSONSchemaEditorProps) {
	const editorRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);

	useEffect(() => {
		if (!editorRef.current) return;

		const initialDoc = config.initialDoc || DEFAULT_DOC;
		const autofocus = config.autofocus ?? true;

		const extensions: Extension[] = [
			// Line numbers and highlighting
			lineNumbers(),
			highlightActiveLineGutter(),
			highlightActiveLine(),
			// Folding
			foldGutter(),
			// Selection features
			dropCursor(),
			rectangularSelection(),
			crosshairCursor(),
			// Language support
			json(),
			syntaxHighlighting(defaultHighlightStyle),
			// Indentation
			indentUnit.of('\t'),
			indentOnInput(),
			// Bracket features
			bracketMatching(),
			closeBrackets(),
			// History
			history(),
			// Selection highlighting
			highlightSelectionMatches(),
			// Keymaps
			keymap.of([
				...defaultKeymap,
				...historyKeymap,
				...foldKeymap,
				...searchKeymap,
				...completionKeymap,
				...closeBracketsKeymap,
				indentWithTab,
			]),
			// Autocompletion with JSON schema
			autocompletion({
				override: [jsonSchemaCompletion],
				activateOnTyping: true,
				closeOnBlur: false,
			}),
		];

		// Add readOnly extension if specified
		if (config.readOnly) {
			extensions.push(EditorState.readOnly.of(true));
		}

		// Add onChange listener if provided
		if (config.onChange) {
			extensions.push(
				EditorView.updateListener.of((update: ViewUpdate) => {
					if (update.docChanged) {
						config.onChange!(update.state.doc.toString());
					}
				})
			);
		}

		const view = new EditorView({
			doc: initialDoc,
			extensions,
			parent: editorRef.current,
		});

		viewRef.current = view;

		formatEditor(view);

		// Position cursor after the first key/value pair if it's the default schema
		const doc = view.state.doc.toString();
		const schemaUrl =
			'"https://playground.wordpress.net/blueprint-schema.json"';
		const schemaLineEnd = doc.indexOf(schemaUrl);
		if (schemaLineEnd > 0) {
			const cursorPos = schemaLineEnd + schemaUrl.length;
			if (cursorPos <= view.state.doc.length) {
				view.dispatch({
					selection: { anchor: cursorPos },
				});
			}
		}

		if (autofocus) {
			view.focus();
		}

		return () => {
			view.destroy();
			viewRef.current = null;
		};
		// Only create the editor once, don't recreate on prop changes
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Handle document updates from parent without recreating the editor
	useEffect(() => {
		const view = viewRef.current;
		if (!view || !config.initialDoc) {
			return;
		}

		const currentDoc = view.state.doc.toString();
		if (config.initialDoc === currentDoc) {
			return;
		}

		// Only update if the change came from outside (not from user typing)
		view.dispatch({
			changes: {
				from: 0,
				to: view.state.doc.length,
				insert: config.initialDoc,
			},
		});
	}, [config.initialDoc]);

	return <div ref={editorRef} className={className} />;
}

export default JSONSchemaEditor;
