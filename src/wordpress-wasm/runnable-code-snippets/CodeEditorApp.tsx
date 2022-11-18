import FilesExplorer from './FilesExplorer';
import { EditorView, basicSetup } from 'codemirror';
import type { ViewUpdate } from '@codemirror/view';
import { keymap } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import React from 'react';
import { useCallback, useState, useMemo, useEffect, useRef } from 'react';

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
	const onChange = useCallback(
		(value) => {
			// @TODO use an async queue to avoid out-of-order updates:
			workerThread.writeFile(file.path, value);
			onSaveFile(file.path);
		},
		[workerThread, file]
	);
	const view = useMemo(() => {
		if (!editorRef.current) {
			return null;
		}

		const syntaxExtension = {
			js: javascript({ jsx: true }),
			ts: javascript({ typescript: true, jsx: true }),
			jsx: javascript({ jsx: true }),
			tsx: javascript({ typescript: true, jsx: true }),
			html: html(),
			css: css(),
			md: markdown(),
			php: php(),
		}[file.path.split('.').pop()!];

		const syntaxExtensions = syntaxExtension ? [syntaxExtension] : [];

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
				updateListener,
				...syntaxExtensions,
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
