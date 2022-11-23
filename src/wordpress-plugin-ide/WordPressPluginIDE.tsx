import React from 'react';
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import FilesExplorer from './FilesExplorer';
import debounce from '../utils/debounce';
import CodeMirror from './CodeMirror';
import { buildWordPressPlugin } from './build-wordpress-plugin';
import type { CodeMirrorRef } from './CodeMirror';
import type { SpawnedWorkerThread } from '../php-wasm-browser/index';
import { setupFixture } from './php-fixtures';
import type { Fixture } from './php-fixtures';
import enableReactFastRefresh from './php-fixtures/enable-react-fast-refresh';
import { pathJoin } from './fs-utils';

interface Props {
	workerThread: SpawnedWorkerThread;
	plugin: Fixture;
	initialEditedFile: string;
	onBundleReady: (code: string) => void;
}

interface FixturePaths {
	srcPath: string;
	buildPath: string;
}

const chroot = '/wordpress/wp-content/mu-plugins/';

// @TODO – Consider using https://github.dev extension instead of a custom
//         CodeMirror setup
//
// @TODO – compile and refresh the code on save with a button or cmd+s,
//         but don't do it automatically on every change.
//
// @TODO – fix the `Block "create-block/example-static" is already registered.`
//         errors occuring when updating the index.js file.
//         Technically we should wrap the factory in try {} finally {} and
//         then refresh the page if it's not a React Component or a CSS file.

export function WordPressPluginIDE({
	workerThread,
	plugin,
	onBundleReady,
	initialEditedFile = '',
}: Props) {
	const editorRef = useRef<CodeMirrorRef>(null);
	const [fixturePaths, setFixturePaths] = useState<FixturePaths | null>(null);
	const [, setEditedFile] = useState<string | null>(null);
	const selectFile = useCallback(
		(fileName) => {
			setEditedFile(fileName);
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
		async function setup() {
			await setupFixture(workerThread, enableReactFastRefresh, chroot);
			const fixturePaths = await setupFixture(
				workerThread,
				plugin,
				chroot
			);
			setFixturePaths(fixturePaths);
			if (initialEditedFile) {
				selectFile(pathJoin(fixturePaths.srcPath, initialEditedFile));
			}

			const bundle = await buildWordPressPlugin(
				workerThread,
				fixturePaths.srcPath,
				fixturePaths.buildPath
			);
			onBundleReady(bundle.contents);
		}
		setup();
	}, []);

	const onFileChange = useMemo(
		() =>
			debounce(async ({ fileName, contents }) => {
				// @TODO use an async queue to avoid out-of-order updates:
				await workerThread.writeFile(fileName, contents);
				const bundle = await buildWordPressPlugin(
					workerThread,
					fixturePaths!.srcPath,
					fixturePaths!.buildPath,
					{
						reloadOnly: true,
					}
				);
				onBundleReady(bundle.contents);
			}, 500),
		[fixturePaths?.srcPath, workerThread]
	);

	if (!fixturePaths) {
		return <div>Loading...</div>;
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'row' }}>
			<FilesExplorer
				chroot={fixturePaths.srcPath!}
				fileSystem={workerThread}
				onSelectFile={selectFile}
				className="ide-panel is-files-explorer"
			/>
			<CodeMirror
				onChange={onFileChange}
				ref={editorRef}
				className="ide-panel is-code-mirror"
			/>
		</div>
	);
}
