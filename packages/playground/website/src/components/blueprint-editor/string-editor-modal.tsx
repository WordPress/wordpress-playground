import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from '@codemirror/commands';
import { php } from '@codemirror/lang-php';
import {
	bracketMatching,
	defaultHighlightStyle,
	foldGutter,
	foldKeymap,
	indentOnInput,
	syntaxHighlighting,
	type LanguageSupport,
} from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import {
	dropCursor,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
} from '@codemirror/view';
import { Button, Flex, FlexItem, SelectControl } from '@wordpress/components';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../modal';
import {
	languageLabels,
	type SupportedLanguage,
} from './infer-language-from-blueprint';
import css from './string-editor-modal.module.css';

interface StringEditorModalProps {
	isOpen: boolean;
	initialValue: string;
	language: SupportedLanguage;
	onSave: (value: string) => void;
	onClose: () => void;
}

/**
 * Load the appropriate CodeMirror language extension
 */
async function loadLanguageExtension(
	language: SupportedLanguage
): Promise<LanguageSupport | null> {
	switch (language) {
		case 'php':
			return php();
		case 'sql':
			return import('@codemirror/lang-sql').then((m) => m.sql());
		case 'html':
			return import('@codemirror/lang-html').then((m) => m.html());
		case 'markdown':
			return import('@codemirror/lang-markdown').then((m) =>
				m.markdown()
			);
		case 'javascript':
			return import('@codemirror/lang-javascript').then((m) =>
				m.javascript()
			);
		case 'css':
			return import('@codemirror/lang-css').then((m) => m.css());
		default:
			return null;
	}
}

export function StringEditorModal({
	isOpen,
	initialValue,
	language: initialLanguage,
	onSave,
	onClose,
}: StringEditorModalProps) {
	const editorRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const languageCompartmentRef = useRef(new Compartment());
	const [language, setLanguage] =
		useState<SupportedLanguage>(initialLanguage);
	const [currentValue, setCurrentValue] = useState(initialValue);

	// Reset state when modal opens with new values
	useEffect(() => {
		if (isOpen) {
			setLanguage(initialLanguage);
			setCurrentValue(initialValue);
		}
	}, [isOpen, initialLanguage, initialValue]);

	// Create the editor
	useEffect(() => {
		if (!isOpen || !editorRef.current) {
			return;
		}

		// Destroy any existing view
		if (viewRef.current) {
			viewRef.current.destroy();
			viewRef.current = null;
		}

		const state = EditorState.create({
			doc: initialValue,
			extensions: [
				lineNumbers(),
				highlightActiveLineGutter(),
				highlightActiveLine(),
				foldGutter(),
				dropCursor(),
				languageCompartmentRef.current.of([]),
				syntaxHighlighting(defaultHighlightStyle),
				indentOnInput(),
				bracketMatching(),
				closeBrackets(),
				history(),
				highlightSelectionMatches(),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						setCurrentValue(update.state.doc.toString());
					}
				}),
				keymap.of([
					{
						key: 'Mod-s',
						preventDefault: true,
						run: () => {
							// Will be handled by the save button
							return true;
						},
					},
					{
						key: 'Escape',
						preventDefault: true,
						run: () => {
							onClose();
							return true;
						},
					},
					...closeBracketsKeymap,
					...foldKeymap,
					...searchKeymap,
					...historyKeymap,
					...defaultKeymap,
					indentWithTab,
				]),
				EditorView.theme({
					'&': {
						height: '100%',
					},
					'.cm-scroller': {
						overflow: 'auto',
					},
				}),
			],
		});

		const view = new EditorView({ state, parent: editorRef.current });
		viewRef.current = view;

		// Load language extension
		void loadLanguageExtension(initialLanguage).then((langSupport) => {
			if (viewRef.current && langSupport) {
				viewRef.current.dispatch({
					effects:
						languageCompartmentRef.current.reconfigure(langSupport),
				});
			}
		});

		// Focus the editor
		setTimeout(() => view.focus(), 0);

		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, [isOpen, initialValue, initialLanguage, onClose]);

	// Handle language change
	const handleLanguageChange = useCallback((newLanguage: string) => {
		const lang = newLanguage as SupportedLanguage;
		setLanguage(lang);

		void loadLanguageExtension(lang).then((langSupport) => {
			if (viewRef.current) {
				viewRef.current.dispatch({
					effects: languageCompartmentRef.current.reconfigure(
						langSupport ?? []
					),
				});
			}
		});
	}, []);

	const handleSave = useCallback(() => {
		onSave(currentValue);
		onClose();
	}, [currentValue, onSave, onClose]);

	if (!isOpen) {
		return null;
	}

	return (
		<Modal
			title="Edit String"
			onRequestClose={onClose}
			className={css.stringEditorModal}
		>
			<div className={css.languageSelector}>
				<SelectControl
					label="Language"
					value={language}
					options={Object.entries(languageLabels).map(
						([value, label]) => ({ value, label })
					)}
					onChange={handleLanguageChange}
					__nextHasNoMarginBottom
				/>
			</div>
			<div className={css.editorContainer} ref={editorRef} />
			<Flex justify="flex-end" className={css.buttons}>
				<FlexItem>
					<Button variant="tertiary" onClick={onClose}>
						Cancel
					</Button>
				</FlexItem>
				<FlexItem>
					<Button variant="primary" onClick={handleSave}>
						Save
					</Button>
				</FlexItem>
			</Flex>
		</Modal>
	);
}
