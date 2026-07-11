import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { PlaygroundFileEditor } from '../PlaygroundFileEditor';
import { createFilesystem } from './file-picker-tree-harness';

type FilesystemName = 'a' | 'b';

type OperationGate = {
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
			setEditorVisible: (isVisible: boolean) => void;
			delayNextRead: () => void;
			releaseDelayedRead: () => void;
			isReadDelayed: () => boolean;
			delayNextWrite: () => void;
			releaseDelayedWrite: () => void;
			isWriteDelayed: () => boolean;
		};
	}
}

export function FileEditorHarness() {
	const nextReadGateRef = useRef<OperationGate | null>(null);
	const activeReadGateRef = useRef<OperationGate | null>(null);
	const nextWriteGateRef = useRef<OperationGate | null>(null);
	const activeWriteGateRef = useRef<OperationGate | null>(null);
	const filesystems = useMemo(() => {
		const filesystemA = createFilesystem();
		const filesystemB = createFilesystem();
		void filesystemB.writeFile(
			'/wordpress/workspace/index.php',
			"<?php echo 'Filesystem B';"
		);

		/** Blocks text and binary reads on the same deterministic gate. */
		const waitForReadRelease = async () => {
			const gate = activeReadGateRef.current ?? nextReadGateRef.current;
			if (!gate) {
				return;
			}
			if (nextReadGateRef.current === gate) {
				nextReadGateRef.current = null;
				activeReadGateRef.current = gate;
			}
			await gate.promise;
			if (activeReadGateRef.current === gate) {
				activeReadGateRef.current = null;
			}
		};

		for (const filesystem of [filesystemA, filesystemB]) {
			const readFileAsText = filesystem.readFileAsText.bind(filesystem);
			filesystem.readFileAsText = async (path) => {
				await waitForReadRelease();
				return readFileAsText(path);
			};

			const read = filesystem.read.bind(filesystem);
			filesystem.read = async (path) => {
				await waitForReadRelease();
				return read(path);
			};
		}

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
	const [isEditorVisible, setIsEditorVisible] = useState(true);

	useEffect(() => {
		window.__fileEditorHarness = {
			filesystems,
			readFileAsText: (filesystem, path) =>
				filesystems[filesystem].readFileAsText(path),
			switchFilesystem: setActiveFilesystem,
			mountEditor: () => setIsEditorMounted(true),
			unmountEditor: () => setIsEditorMounted(false),
			setEditorVisible: setIsEditorVisible,
			delayNextRead: () => {
				nextReadGateRef.current = createOperationGate();
			},
			releaseDelayedRead: () => {
				activeReadGateRef.current?.release();
				nextReadGateRef.current?.release();
			},
			isReadDelayed: () => activeReadGateRef.current !== null,
			delayNextWrite: () => {
				nextWriteGateRef.current = createOperationGate();
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
				<button type="button" data-testid="file-editor-focus-sentinel">
					Focus sentinel
				</button>
			</header>
			<div style={{ flex: 1, minHeight: 0 }}>
				{isEditorMounted ? (
					<PlaygroundFileEditor
						filesystem={filesystems[activeFilesystem]}
						isVisible={isEditorVisible}
						documentRoot="/wordpress"
						initialPath="/wordpress/workspace/index.php"
					/>
				) : null}
			</div>
		</div>
	);
}

/** Creates a manually released gate for deterministic harness operations. */
function createOperationGate(): OperationGate {
	let release: () => void = () => undefined;
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release };
}
