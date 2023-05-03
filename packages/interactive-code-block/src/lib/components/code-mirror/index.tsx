import type { ViewUpdate } from '@codemirror/view';
import {
	EditorView,
	keymap,
	highlightSpecialChars,
	drawSelection,
	highlightActiveLine,
	dropCursor,
	rectangularSelection,
	crosshairCursor,
	lineNumbers,
	highlightActiveLineGutter,
} from '@codemirror/view';
import {
	defaultHighlightStyle,
	syntaxHighlighting,
	indentOnInput,
	bracketMatching,
	foldGutter,
	foldKeymap,
} from '@codemirror/language';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';

import {
	useState,
	useMemo,
	useEffect,
	useRef,
	useImperativeHandle,
	forwardRef,
	memo,
} from '@wordpress/element';

import type {
	ForwardRefExoticComponent,
	MemoExoticComponent,
	RefAttributes,
} from 'react';

export interface CodeMirrorProps {
	onChange?: (updatedContents: string) => void;
	onSave?: (updatedContents: string) => void;
	initialContents: string;
	fileType: 'php' | 'sql' | 'js';
	className?: string;
}

export type CodeMirrorRef = {
	getContents: () => string;
};

const CodeMirror: MemoExoticComponent<
	ForwardRefExoticComponent<CodeMirrorProps & RefAttributes<CodeMirrorRef>>
> = memo(
	forwardRef<CodeMirrorRef, CodeMirrorProps>(function CodeMirror(
		{ onChange, onSave, initialContents, fileType, className = '' },
		ref
	) {
		const codeMirrorRef = useRef(null);
		const contentsRef = useRef(initialContents);
		const onChangeRef = useRef(onChange);
		const languagePlugin = useLanguagePlugin(fileType);
		// For rerendering:
		const [dep, setDep] = useState({});

		useImperativeHandle(ref, () => ({
			getContents: () => contentsRef.current,
		}));
		useEffect(() => {
			onChangeRef.current = onChange;
		}, [onChange]);

		const view = useMemo(() => {
			if (!codeMirrorRef.current) {
				// Rerender
				setTimeout(() => setDep({}));
				return null;
			}

			const themeOptions = EditorView.theme({
				'&': {
					height: 'auto',
					width: '100%',
				},
			});

			const ourKeymap = (keymap as any).of([
				{
					key: 'Mod-s',
					run() {
						if (typeof onSave === 'function') {
							onSave(contentsRef.current);
						}
						return true;
					},
				},
				...closeBracketsKeymap,
				...defaultKeymap,
				...historyKeymap,
				...foldKeymap,
			]);

			const updateListener = EditorView.updateListener.of(
				(vu: ViewUpdate) => {
					if (vu.docChanged) {
						contentsRef.current = vu.state.doc.toString();
						if (typeof onChangeRef.current === 'function') {
							onChangeRef.current(contentsRef.current);
						}
					}
				}
			);

			const extensions = [
				lineNumbers(),
				highlightActiveLineGutter(),
				highlightSpecialChars(),
				history(),
				foldGutter(),
				drawSelection(),
				dropCursor(),
				indentOnInput(),
				syntaxHighlighting(defaultHighlightStyle, {
					fallback: true,
				}),
				bracketMatching(),
				closeBrackets(),
				rectangularSelection(),
				crosshairCursor(),
				highlightActiveLine(),
				oneDark,
				themeOptions,
				ourKeymap,
			];

			if (languagePlugin) {
				extensions.push(languagePlugin());
			}
			extensions.push(updateListener);

			const _view = new EditorView({
				doc: initialContents,
				extensions,
				parent: codeMirrorRef.current,
			});

			return _view;
		}, [languagePlugin, dep, codeMirrorRef.current]);

		useEffect(() => {
			// return a function to be executed at component unmount
			return () => {
				view && view.destroy();
			};
		}, [view]);

		return <div ref={codeMirrorRef} className={className} />;
	})
);

export default CodeMirror;

function useLanguagePlugin(language: string): any {
	const lastLanguageRef = useRef(language);
	const [plugin, setPlugin] = useState(null);
	useEffect(() => {
		lastLanguageRef.current = language;
		importLanguagePlugin(language).then((pluginFactory) => {
			if (lastLanguageRef.current === language) {
				setPlugin(() => pluginFactory);
			}
		});
	}, [language]);
	return plugin;
}

async function importLanguagePlugin(fileType: string): Promise<any> {
	switch (fileType) {
		case 'js':
			return (await import('@codemirror/lang-javascript')).javascript;
		case 'php':
			return (await import('@codemirror/lang-php')).php;
		case 'sql':
			return (await import('@codemirror/lang-sql')).sql;
		default:
			throw new Error(`Unknown file type: ${fileType}`);
	}
}
