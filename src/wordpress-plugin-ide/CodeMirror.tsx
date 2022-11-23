import { EditorView, basicSetup } from 'codemirror';
import type { ViewUpdate } from '@codemirror/view';
import { keymap } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { linter, lintKeymap, lintGutter } from '@codemirror/lint';

import React from 'react';
import {
	useState,
	useMemo,
	useEffect,
	useRef,
	useImperativeHandle,
} from 'react';
import { babelTranspile } from './bundler/index';
import type { MemFile } from './fs-utils';

interface CodeMirrorProps {
	onChange: (updatedFile: MemFile) => void;
	initialFile?: MemFile;
	className?: string;
}

export type CodeMirrorRef = {
	setFile: (file: MemFile) => void;
};

export default React.forwardRef<CodeMirrorRef, CodeMirrorProps>(
	function CodeMirror({ onChange, initialFile, className = '' }, ref) {
		const codeMirrorRef = useRef(null);
		const [file, setFile] = useState<MemFile>(
			initialFile || {
				fileName: 'fake.js',
				contents: "console.log('hello world!');",
			}
		);

		useImperativeHandle(ref, () => ({
			setFile,
		}));
		const view = useMemo(() => {
			if (!codeMirrorRef.current) {
				return null;
			}

			const fileSpecificExtensions = {
				js: () => [javascript({ jsx: true }), babelLinter],
				ts: () => [
					javascript({ typescript: true, jsx: true }),
					babelLinter,
				],
				jsx: () => [javascript({ jsx: true }), babelLinter],
				tsx: () => [
					javascript({ typescript: true, jsx: true }),
					babelLinter,
				],
				json: () => [json(), linter(jsonParseLinter())],
				html: () => [html()],
				css: () => [css()],
				md: () => [markdown()],
				php: () => [php()],
			}[file.fileName.split('.').pop()!]();

			const themeOptions = EditorView.theme({
				'&': {
					height: '350px',
					width: '100%',
				},
			});

			const ourKeymap = keymap.of([
				{
					key: 'Mod-s',
					run() {
						return true;
					},
				},
				...lintKeymap,
			]);

			const updateListener = EditorView.updateListener.of(
				(vu: ViewUpdate) => {
					if (vu.docChanged && typeof onChange === 'function') {
						onChange({
							fileName: file.fileName,
							contents: vu.state.doc.toString(),
						});
					}
				}
			);

			const _view = new EditorView({
				doc: file.contents,
				extensions: [
					basicSetup,
					themeOptions,
					ourKeymap,
					...fileSpecificExtensions,
					lintGutter(),
					updateListener,
				],
				parent: codeMirrorRef.current,
			});

			return _view;
		}, [file.fileName, codeMirrorRef.current, onChange]);

		useEffect(() => {
			// return a function to be executed at component unmount
			return () => view && view.destroy();
		}, [view]);

		return <div ref={codeMirrorRef} className={className} />;
	}
);

const babelLinter = linter((view) => {
	let diagnostics: any[] = [];
	const code: string = view.state.doc.toString();
	try {
		babelTranspile(code);
	} catch (e: any) {
		const line = view.state.doc.lineAt(e.loc.index);
		diagnostics.push({
			from: line.from,
			to: line.to,
			severity: 'error',
			message: e.message,
		});
	}
	return diagnostics;
});
