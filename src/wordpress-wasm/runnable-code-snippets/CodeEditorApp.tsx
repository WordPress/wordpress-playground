import FilesExplorer from './FilesExplorer';
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
import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import debounce from '../../utils/debounce';
import { babelTranspile } from '../bundling/index';

export default function CodeEditorApp({
	workerThread,
	root = '/wordpress/wp-content/mu-plugins/',
	onSaveFile = (path: string) => {},
	initialFile = '',
}) {
	const editorRef = useRef(null);
	const [file, setFile] = useState({
		path: '/tmp/fake.js',
		contents: "console.log('hello world!');",
	});
	const onSelectFile = useCallback(
		(path) => {
			async function handle() {
				setFile({ path, contents: await workerThread.readFile(path) });
			}
			handle();
		},
		[workerThread]
	);
	useEffect(() => {
		if (initialFile) {
			onSelectFile(initialFile);
		}
	}, []);
	const onChange = useMemo(
		() =>
			debounce((value) => {
				// @TODO use an async queue to avoid out-of-order updates:
				workerThread.writeFile(file.path, value);
				onSaveFile(file.path);
			}, 500),
		[workerThread, file]
	);
	const view = useMemo(() => {
		if (!editorRef.current) {
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
		}[file.path.split('.').pop()!]();

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
					const doc = vu.state.doc;
					const value = doc.toString();
					onChange(value);
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
			parent: editorRef.current,
		});

		return _view;
	}, [file, editorRef.current, onChange]);

	useEffect(() => {
		// return a function to be executed at component unmount
		return () => view && view.destroy();
	}, [view]);

	return (
		<div style={{ display: 'flex', flexDirection: 'row' }}>
			<div style={{ width: 300 }}>
				<FilesExplorer
					root={root}
					filesSource={workerThread}
					onSelectFile={onSelectFile}
				/>
			</div>
			<div
				ref={editorRef}
				style={{
					width: '100%',
					minHeight: 300,
				}}
			></div>
		</div>
	);
}

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
