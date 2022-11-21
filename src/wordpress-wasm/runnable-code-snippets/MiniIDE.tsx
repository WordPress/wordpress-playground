import React from 'react';
import { useCallback, useMemo, useEffect, useRef } from 'react';
import FilesExplorer from './FilesExplorer';
import debounce from '../../utils/debounce';
import CodeMirror from './CodeMirror';
import type { CodeMirrorRef } from './CodeMirror';

export default function IDE({
	workerThread,
	root = '/wordpress/wp-content/mu-plugins/',
	onSaveFile = (path: string) => {},
	initialFile = '',
}) {
	const editorRef = useRef<CodeMirrorRef>(null);
	const selectFile = useCallback(
		(fileName) => {
			workerThread.readFile(fileName).then((contents) =>
				editorRef.current!.setFile({
					fileName,
					contents,
				})
			);
		},
		[workerThread]
	);
	useEffect(() => {
		if (initialFile) {
			selectFile(initialFile);
		}
	}, []);
	const onCodeChange = useMemo(
		() =>
			debounce(({ fileName, contents }) => {
				// @TODO use an async queue to avoid out-of-order updates:
				workerThread.writeFile(fileName, contents);
				onSaveFile(fileName);
			}, 500),
		[workerThread]
	);

	return (
		<div style={{ display: 'flex', flexDirection: 'row' }}>
			<div style={{ width: 300 }}>
				<FilesExplorer
					root={root}
					filesSource={workerThread}
					onSelectFile={selectFile}
				/>
			</div>
			<CodeMirror onChange={onCodeChange} ref={editorRef} />
		</div>
	);
}
