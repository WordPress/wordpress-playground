import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { PlaygroundFileEditor } from '../PlaygroundFileEditor';
import { createFilesystem } from './file-picker-tree-harness';

declare global {
	interface Window {
		__fileEditorHarness?: {
			filesystem: AsyncWritableFilesystem;
			/** Reads one file from either synthetic filesystem. */
			readFileAsText: (
				path: string,
				filesystemIndex?: number
			) => Promise<string>;
			/** Replaces the editor without replacing its persisted identity. */
			remount: () => void;
			/** Selects an exact persisted identity for the mounted editor. */
			setPersistKey: (key: string | undefined) => void;
			/** Alternates between the two keyed editor identities. */
			switchPersistKey: () => void;
			/** Replaces the editor root and the path opened within it. */
			setDocumentRoot: (root: string, initialPath: string) => void;
			/** Removes one file from the active synthetic filesystem. */
			deleteFile: (path: string) => Promise<void>;
			/** Switches to the other synthetic filesystem. */
			switchFilesystem: () => void;
			/** Temporarily removes the filesystem from the mounted editor. */
			disconnectFilesystem: () => void;
			/** Restores the current filesystem to the mounted editor. */
			reconnectFilesystem: () => void;
			/** Makes the next write to this filesystem fail once. */
			failCurrentFilesystemWrites: () => void;
			/** Holds filesystem writes until releaseDelayedWrites is called. */
			delayCurrentFilesystemWrites: () => void;
			/** Resolves after a delayed write reaches the filesystem. */
			waitForDelayedWrite: () => Promise<void>;
			/** Allows delayed filesystem writes to finish. */
			releaseDelayedWrites: () => void;
			/** Rejects delayed filesystem writes after releasing their wait. */
			rejectDelayedWrites: () => void;
			/** Defers one file read after capturing its pre-mutation contents. */
			deferNextRead: (path: string) => void;
			/** Reports whether the deferred read is waiting or finished. */
			getDeferredReadState: () => 'idle' | 'waiting' | 'completed';
			/** Allows the deferred file read to return its captured contents. */
			releaseDeferredRead: () => void;
			/** Defers the next directory check for one path until released. */
			deferNextIsDir: (path: string) => void;
			/** Reports whether the deferred check is waiting or finished. */
			getDeferredIsDirState: () => 'idle' | 'waiting' | 'completed';
			/** Releases the directory check installed by deferNextIsDir. */
			releaseDeferredIsDir: () => void;
			/** Defers one rename or deletion after it reaches the filesystem. */
			deferNextMutation: (
				operation: 'mv' | 'unlink',
				path: string
			) => void;
			/** Reports whether the deferred mutation is waiting or finished. */
			getDeferredMutationState: () => 'idle' | 'waiting' | 'completed';
			/** Allows the deferred rename or deletion to finish. */
			releaseDeferredMutation: () => void;
		};
	}
}

/** Creates a distinct object identity that forwards to one shared filesystem. */
function createFilesystemFacade(
	filesystem: AsyncWritableFilesystem,
	_identity: number
): AsyncWritableFilesystem {
	const facade = new EventTarget() as AsyncWritableFilesystem;
	facade.isDir = (path) => filesystem.isDir(path);
	facade.fileExists = (path) => filesystem.fileExists(path);
	facade.read = (path) => filesystem.read(path);
	facade.readFileAsText = (path) => filesystem.readFileAsText(path);
	facade.listFiles = (path) => filesystem.listFiles(path);
	facade.writeFile = (path, data) => filesystem.writeFile(path, data);
	facade.mkdir = (path, options) => filesystem.mkdir(path, options);
	facade.rmdir = (path, options) => filesystem.rmdir(path, options);
	facade.mv = (source, destination) => filesystem.mv(source, destination);
	facade.unlink = (path) => filesystem.unlink(path);
	return facade;
}

/**
 * Exposes deterministic editor identity changes to the Playwright suite.
 *
 * The component key, persistence key, document root, and a pair of filesystem
 * objects can change independently. That distinction catches state leaking
 * between editor identities instead of hiding it behind a full page reload.
 */
export function FileEditorHarness() {
	const [mountKey, setMountKey] = useState(0);
	const [persistKey, setPersistKey] = useState<string | undefined>('site-a');
	const [editorLocation, setEditorLocation] = useState({
		documentRoot: '/wordpress',
		initialPath: '/wordpress/workspace/index.php',
	});
	const filesystems = useMemo(
		() => [createFilesystem(), createFilesystem()],
		[]
	);
	const [filesystemIndex, setFilesystemIndex] = useState(0);
	const backingFilesystem = filesystems[filesystemIndex];
	const filesystem = useMemo(
		() => createFilesystemFacade(backingFilesystem, mountKey),
		[backingFilesystem, mountKey]
	);
	const filesystemFacadeRef = useRef(filesystem);
	filesystemFacadeRef.current = filesystem;
	const [filesystemConnected, setFilesystemConnected] = useState(true);

	useEffect(() => {
		const originalIsDir = backingFilesystem.isDir.bind(backingFilesystem);
		const originalRead = backingFilesystem.read.bind(backingFilesystem);
		const originalWriteFile =
			backingFilesystem.writeFile.bind(backingFilesystem);
		const originalMv = backingFilesystem.mv.bind(backingFilesystem);
		const originalUnlink = backingFilesystem.unlink.bind(backingFilesystem);
		let deferredReadState: 'idle' | 'waiting' | 'completed' = 'completed';
		let releaseDeferredRead: (() => void) | undefined;
		let deferredIsDirState: 'idle' | 'waiting' | 'completed' = 'completed';
		let releaseDeferredIsDir: (() => void) | undefined;
		let deferredMutationState: 'idle' | 'waiting' | 'completed' =
			'completed';
		let releaseDeferredMutation: (() => void) | undefined;
		let delayedWriteStarted = Promise.resolve();
		let markDelayedWriteStarted: (() => void) | undefined;
		let delayedWriteGate = Promise.resolve();
		let releaseDelayedWrites: (() => void) | undefined;
		let shouldRejectDelayedWrites = false;
		let keepFailedWriteUntilAttempted = false;
		window.__fileEditorHarness = {
			get filesystem() {
				return filesystemFacadeRef.current;
			},
			readFileAsText: (path, index = filesystemIndex) =>
				filesystems[index].readFileAsText(path),
			remount: () => setMountKey((key) => key + 1),
			setPersistKey,
			switchPersistKey: () => {
				setPersistKey((key) =>
					key === 'site-a' ? 'site-b' : 'site-a'
				);
			},
			setDocumentRoot: (documentRoot, initialPath) => {
				setEditorLocation({ documentRoot, initialPath });
			},
			deleteFile: (path) => backingFilesystem.unlink(path),
			switchFilesystem: () => {
				setFilesystemConnected(true);
				setFilesystemIndex((index) => (index === 0 ? 1 : 0));
			},
			disconnectFilesystem: () => setFilesystemConnected(false),
			reconnectFilesystem: () => setFilesystemConnected(true),
			failCurrentFilesystemWrites: () => {
				backingFilesystem.writeFile = async () => {
					backingFilesystem.writeFile = originalWriteFile;
					throw new Error('Harness write failure');
				};
				// A filesystem switch tears down this harness effect before the
				// editor's queued transaction runs. Leave this one-shot failure in
				// place until that transaction reaches it.
				keepFailedWriteUntilAttempted = true;
			},
			delayCurrentFilesystemWrites: () => {
				delayedWriteStarted = new Promise((resolve) => {
					markDelayedWriteStarted = resolve;
				});
				delayedWriteGate = new Promise((resolve) => {
					releaseDelayedWrites = resolve;
				});
				backingFilesystem.writeFile = async (...args) => {
					markDelayedWriteStarted?.();
					markDelayedWriteStarted = undefined;
					await delayedWriteGate;
					if (shouldRejectDelayedWrites) {
						throw new Error('Harness delayed write failure');
					}
					return originalWriteFile(...args);
				};
			},
			waitForDelayedWrite: () => delayedWriteStarted,
			releaseDelayedWrites: () => releaseDelayedWrites?.(),
			rejectDelayedWrites: () => {
				shouldRejectDelayedWrites = true;
				releaseDelayedWrites?.();
			},
			deferNextRead: (path) => {
				deferredReadState = 'idle';
				const gate = new Promise<void>((resolve) => {
					releaseDeferredRead = resolve;
				});
				backingFilesystem.read = async (candidate) => {
					if (candidate !== path || deferredReadState !== 'idle') {
						return originalRead(candidate);
					}
					const result = await originalRead(candidate);
					deferredReadState = 'waiting';
					await gate;
					deferredReadState = 'completed';
					backingFilesystem.read = originalRead;
					return result;
				};
			},
			getDeferredReadState: () => deferredReadState,
			releaseDeferredRead: () => releaseDeferredRead?.(),
			deferNextIsDir: (path) => {
				deferredIsDirState = 'idle';
				const gate = new Promise<void>((resolve) => {
					releaseDeferredIsDir = resolve;
				});
				backingFilesystem.isDir = async (candidate) => {
					if (candidate !== path || deferredIsDirState !== 'idle') {
						return originalIsDir(candidate);
					}
					deferredIsDirState = 'waiting';
					await gate;
					const result = await originalIsDir(candidate);
					deferredIsDirState = 'completed';
					backingFilesystem.isDir = originalIsDir;
					return result;
				};
			},
			getDeferredIsDirState: () => deferredIsDirState,
			releaseDeferredIsDir: () => releaseDeferredIsDir?.(),
			deferNextMutation: (operation, path) => {
				deferredMutationState = 'idle';
				const gate = new Promise<void>((resolve) => {
					releaseDeferredMutation = resolve;
				});
				backingFilesystem.mv = async (source, destination) => {
					if (
						operation !== 'mv' ||
						source !== path ||
						deferredMutationState !== 'idle'
					) {
						return originalMv(source, destination);
					}
					deferredMutationState = 'waiting';
					await gate;
					await originalMv(source, destination);
					deferredMutationState = 'completed';
					backingFilesystem.mv = originalMv;
				};
				backingFilesystem.unlink = async (candidate) => {
					if (
						operation !== 'unlink' ||
						candidate !== path ||
						deferredMutationState !== 'idle'
					) {
						return originalUnlink(candidate);
					}
					deferredMutationState = 'waiting';
					await gate;
					await originalUnlink(candidate);
					deferredMutationState = 'completed';
					backingFilesystem.unlink = originalUnlink;
				};
			},
			getDeferredMutationState: () => deferredMutationState,
			releaseDeferredMutation: () => releaseDeferredMutation?.(),
		};
		return () => {
			backingFilesystem.isDir = originalIsDir;
			backingFilesystem.read = originalRead;
			backingFilesystem.mv = originalMv;
			backingFilesystem.unlink = originalUnlink;
			if (!keepFailedWriteUntilAttempted) {
				backingFilesystem.writeFile = originalWriteFile;
			}
			delete window.__fileEditorHarness;
		};
	}, [backingFilesystem, filesystemIndex, filesystems]);

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
					display: 'flex',
					gap: '0.5rem',
					alignItems: 'center',
					padding: '0.75rem 1rem',
					background: '#fff',
					borderBottom: '1px solid #ddd',
				}}
			>
				<strong>PlaygroundFileEditor harness</strong>
				<span data-testid="mount-key">mountKey: {mountKey}</span>
				<span data-testid="persist-key">
					persistKey: {persistKey ?? 'undefined'}
				</span>
				<span data-testid="document-root">
					documentRoot: {editorLocation.documentRoot}
				</span>
				<button onClick={() => setMountKey((key) => key + 1)}>
					Remount editor
				</button>
				<button
					onClick={() =>
						setPersistKey((key) =>
							key === 'site-a' ? 'site-b' : 'site-a'
						)
					}
				>
					Switch persistKey
				</button>
				<button onClick={() => setPersistKey(undefined)}>
					Clear persistKey
				</button>
			</header>
			<div style={{ flex: 1, minHeight: 0 }}>
				<PlaygroundFileEditor
					key={mountKey}
					filesystem={filesystemConnected ? filesystem : null}
					documentRoot={editorLocation.documentRoot}
					initialPath={editorLocation.initialPath}
					persistKey={persistKey}
				/>
			</div>
		</div>
	);
}
