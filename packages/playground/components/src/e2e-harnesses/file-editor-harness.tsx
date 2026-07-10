import React, { useEffect, useMemo } from 'react';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { PlaygroundFileEditor } from '../PlaygroundFileEditor';
import { createFilesystem } from './file-picker-tree-harness';

declare global {
	interface Window {
		__fileEditorHarness?: {
			filesystem: AsyncWritableFilesystem;
			readFileAsText: (path: string) => Promise<string>;
		};
	}
}

export function FileEditorHarness() {
	const filesystem = useMemo(() => createFilesystem(), []);

	useEffect(() => {
		window.__fileEditorHarness = {
			filesystem,
			readFileAsText: (path: string) => filesystem.readFileAsText(path),
		};
		return () => {
			delete window.__fileEditorHarness;
		};
	}, [filesystem]);

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
				<PlaygroundFileEditor
					filesystem={filesystem}
					documentRoot="/wordpress"
					initialPath="/wordpress/workspace/index.php"
				/>
			</div>
		</div>
	);
}
