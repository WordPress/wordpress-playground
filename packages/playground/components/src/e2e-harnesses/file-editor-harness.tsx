import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { PlaygroundFileEditor } from '../PlaygroundFileEditor';
import { createFilesystem } from './file-picker-tree-harness';

type FilesystemName = 'a' | 'b';

type WriteGate = {
	promise: Promise<void>;
	release: () => void;
};

declare global {
	interface Window {
		__fileEditorHarness?: {
			filesystems: Record<FilesystemName, AsyncWritableFilesystem>;
			readFileAsText: (
				filesystem: FilesystemName,
				path: string
			) => Promise<string>;
			switchFilesystem: (filesystem: FilesystemName) => void;
			mountEditor: () => void;
			unmountEditor: () => void;
			delayNextWrite: () => void;
			releaseDelayedWrite: () => void;
			isWriteDelayed: () => boolean;
		};
	}
}

export function FileEditorHarness() {
	const nextWriteGateRef = useRef<WriteGate | null>(null);
	const activeWriteGateRef = useRef<WriteGate | null>(null);
	const filesystems = useMemo(() => {
		const filesystemA = createFilesystem();
		const filesystemB = createFilesystem();
		void filesystemB.writeFile(
			'/wordpress/workspace/index.php',
			"<?php echo 'Filesystem B';"
		);

		const writeFile = filesystemA.writeFile.bind(filesystemA);
		filesystemA.writeFile = async (path, data) => {
			const gate = nextWriteGateRef.current;
			if (gate) {
				nextWriteGateRef.current = null;
				activeWriteGateRef.current = gate;
				await gate.promise;
				activeWriteGateRef.current = null;
			}
			await writeFile(path, data);
		};

		return { a: filesystemA, b: filesystemB };
	}, []);
	const [activeFilesystem, setActiveFilesystem] =
		useState<FilesystemName>('a');
	const [isEditorMounted, setIsEditorMounted] = useState(true);

	useEffect(() => {
		window.__fileEditorHarness = {
			filesystems,
			readFileAsText: (filesystem, path) =>
				filesystems[filesystem].readFileAsText(path),
			switchFilesystem: setActiveFilesystem,
			mountEditor: () => setIsEditorMounted(true),
			unmountEditor: () => setIsEditorMounted(false),
			delayNextWrite: () => {
				let release: () => void = () => undefined;
				const promise = new Promise<void>((resolve) => {
					release = resolve;
				});
				nextWriteGateRef.current = { promise, release };
			},
			releaseDelayedWrite: () => {
				activeWriteGateRef.current?.release();
				nextWriteGateRef.current?.release();
			},
			isWriteDelayed: () => activeWriteGateRef.current !== null,
		};
		return () => {
			delete window.__fileEditorHarness;
		};
	}, [filesystems]);

	return (
		<div
			style={{
				minHeight: '100vh',
				display: 'flex',
				flexDirection: 'column',
				background: '#f5f5f5',
			}}
		>
			<header
				style={{
					padding: '0.75rem 1rem',
					background: '#fff',
					borderBottom: '1px solid #ddd',
				}}
			>
				<strong>PlaygroundFileEditor harness</strong>
			</header>
			<div style={{ flex: 1, minHeight: 0 }}>
				{isEditorMounted ? (
					<PlaygroundFileEditor
						filesystem={filesystems[activeFilesystem]}
						documentRoot="/wordpress"
						initialPath="/wordpress/workspace/index.php"
					/>
				) : null}
			</div>
		</div>
	);
}
