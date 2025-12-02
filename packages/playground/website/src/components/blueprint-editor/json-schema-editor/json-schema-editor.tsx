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
import { EditorState, StateField, type Extension } from '@codemirror/state';
import {
	crosshairCursor,
	dropCursor,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
	rectangularSelection,
	showTooltip,
	type Tooltip,
	type ViewUpdate,
} from '@codemirror/view';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	inferLanguageFromBlueprint,
	type SupportedLanguage,
} from '../infer-language-from-blueprint';
import { StringEditorModal } from '../string-editor-modal';
import type { JSONSchemaCompletionConfig } from './types';
import {
	formatEditor,
	getStringNodeAtPosition,
	jsonSchemaCompletion,
} from './jsonSchemaCompletion';

interface JSONSchemaEditorProps {
	config?: JSONSchemaCompletionConfig;
	className?: string;
}

interface StringEditorState {
	isOpen: boolean;
	initialValue: string;
	language: SupportedLanguage;
	contentStart: number;
	contentEnd: number;
}

const DEFAULT_DOC = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json"
}`;

/**
 * Create the string editor toolbar tooltip extension
 */
function createStringEditorTooltip(openStringEditor: () => boolean) {
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

	return stringEditorTooltipField;
}

export function JSONSchemaEditor({
	config = {},
	className = '',
}: JSONSchemaEditorProps) {
	const editorRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);

	// State for the string editor modal
	const [stringEditorState, setStringEditorState] =
		useState<StringEditorState>({
			isOpen: false,
			initialValue: '',
			language: 'plaintext',
			contentStart: 0,
			contentEnd: 0,
		});

	// Open the string editor modal for the string at the current cursor position
	const openStringEditor = useCallback(() => {
		const view = viewRef.current;
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
			const view = viewRef.current;
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
		setTimeout(() => viewRef.current?.focus(), 0);
	}, []);

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
				{
					key: 'Mod-e',
					preventDefault: true,
					run: () => openStringEditor(),
				},
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
			// String editor toolbar tooltip
			createStringEditorTooltip(openStringEditor),
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

	return (
		<>
			<div ref={editorRef} className={className} />
			<StringEditorModal
				isOpen={stringEditorState.isOpen}
				initialValue={stringEditorState.initialValue}
				language={stringEditorState.language}
				onSave={handleStringEditorSave}
				onClose={closeStringEditor}
			/>
		</>
	);
}

export default JSONSchemaEditor;
