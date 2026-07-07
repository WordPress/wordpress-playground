// @vitest-environment jsdom
import type * as ReactModule from 'react';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { basename, dirname, normalizePath } from '@php-wasm/util';
import { PlaygroundFileEditor } from './playground-file-editor';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
	latestSidebarProps: undefined as any,
	latestEditorProps: undefined as any,
	editorHandle: {
		focus: vi.fn(),
		blur: vi.fn(),
		getCursorPosition: vi.fn(() => 0),
		setCursorPosition: vi.fn(),
	},
}));

vi.mock('@wordpress/components', async () => {
	const ReactActual = await vi.importActual<typeof ReactModule>('react');
	return {
		Button: (props: any) => {
			const buttonProps = { ...props };
			for (const prop of [
				'icon',
				'iconPosition',
				'iconSize',
				'isBusy',
				'isDestructive',
				'variant',
			]) {
				delete buttonProps[prop];
			}
			return ReactActual.createElement(
				'button',
				buttonProps,
				props.children
			);
		},
		Notice: ({ children }: any) =>
			ReactActual.createElement('div', { role: 'alert' }, children),
	};
});

vi.mock('./file-explorer-sidebar', async () => {
	const ReactActual = await vi.importActual<typeof ReactModule>('react');
	return {
		FileExplorerSidebar: (props: any) => {
			mocks.latestSidebarProps = props;
			return ReactActual.createElement('div', {
				'aria-label': 'Files',
			});
		},
	};
});

vi.mock('./code-editor', async () => {
	const ReactActual = await vi.importActual<typeof ReactModule>('react');
	return {
		CodeEditor: ReactActual.forwardRef((props: any, ref) => {
			mocks.latestEditorProps = props;
			ReactActual.useImperativeHandle(ref, () => mocks.editorHandle);
			return ReactActual.createElement('textarea', {
				value: props.code,
				readOnly: props.readOnly,
				onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
					props.onChange(event.target.value),
			});
		}),
	};
});

describe('PlaygroundFileEditor file tree mutations', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		vi.useFakeTimers();
		mocks.latestSidebarProps = undefined;
		mocks.latestEditorProps = undefined;
		mocks.editorHandle.focus.mockClear();
		mocks.editorHandle.blur.mockClear();
		mocks.editorHandle.getCursorPosition.mockClear();
		mocks.editorHandle.getCursorPosition.mockReturnValue(0);
		mocks.editorHandle.setCursorPosition.mockClear();
		container = document.createElement('div');
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => {
			root.unmount();
		});
		container.remove();
		vi.useRealTimers();
	});

	it('remaps the current file after rename without recreating the old path', async () => {
		const filesystem = new InMemoryFilesystem({
			'/wordpress/index.php': 'old content',
		});
		renderEditor(root, filesystem);
		await openFile('/wordpress/index.php', 'old content');
		await changeEditorContent('changed content');

		await expectBeforePathChange('/wordpress/index.php', true);
		await expect(
			filesystem.readFileAsText('/wordpress/index.php')
		).resolves.toBe('changed content');

		await filesystem.mv('/wordpress/index.php', '/wordpress/main.php');
		await act(async () => {
			await mocks.latestSidebarProps.onPathMoved(
				'/wordpress/index.php',
				'/wordpress/main.php'
			);
		});
		await act(async () => {
			vi.advanceTimersByTime(1500);
		});

		expect(mocks.latestEditorProps.currentPath).toBe('/wordpress/main.php');
		await expect(
			filesystem.fileExists('/wordpress/index.php')
		).resolves.toBe(false);
		await expect(
			filesystem.readFileAsText('/wordpress/main.php')
		).resolves.toBe('changed content');
	});

	it('keeps pending saves for unrelated path changes', async () => {
		const filesystem = new InMemoryFilesystem({
			'/wordpress/index.php': 'old content',
			'/wordpress/other.php': 'other content',
		});
		renderEditor(root, filesystem);
		await openFile('/wordpress/index.php', 'old content');
		await changeEditorContent('changed content');

		await expectBeforePathChange('/wordpress/other.php', true);
		await filesystem.mv('/wordpress/other.php', '/wordpress/moved.php');
		await act(async () => {
			await mocks.latestSidebarProps.onPathMoved(
				'/wordpress/other.php',
				'/wordpress/moved.php'
			);
		});
		await act(async () => {
			vi.advanceTimersByTime(1500);
		});

		await expect(
			filesystem.readFileAsText('/wordpress/index.php')
		).resolves.toBe('changed content');
	});

	it('clears a deleted open file without saving it again', async () => {
		const filesystem = new InMemoryFilesystem({
			'/wordpress/index.php': 'old content',
		});
		renderEditor(root, filesystem);
		await openFile('/wordpress/index.php', 'old content');
		await changeEditorContent('changed content');

		await expectBeforePathChange('/wordpress/index.php', true);
		await filesystem.unlink('/wordpress/index.php');
		await act(async () => {
			await mocks.latestSidebarProps.onPathDeleted(
				'/wordpress/index.php'
			);
			await mocks.latestSidebarProps.onSelectionCleared();
		});
		await act(async () => {
			vi.advanceTimersByTime(1500);
		});

		await expect(
			filesystem.fileExists('/wordpress/index.php')
		).resolves.toBe(false);
		expect(filesystem.writeLog).toEqual([
			{ path: '/wordpress/index.php', content: 'changed content' },
		]);
	});
});

function renderEditor(root: Root, filesystem: AsyncWritableFilesystem) {
	act(() => {
		root.render(
			<PlaygroundFileEditor
				filesystem={filesystem}
				documentRoot="/wordpress"
			/>
		);
	});
}

async function openFile(path: string, content: string) {
	await act(async () => {
		await mocks.latestSidebarProps.onFileOpened(path, content, false);
	});
}

async function changeEditorContent(content: string) {
	await act(async () => {
		mocks.latestEditorProps.onChange(content);
	});
}

async function expectBeforePathChange(path: string, expected: boolean) {
	let result: unknown;
	await act(async () => {
		result = await mocks.latestSidebarProps.onBeforePathChange(path);
	});
	expect(result).toBe(expected);
}

class InMemoryFilesystem
	extends EventTarget
	implements AsyncWritableFilesystem
{
	readonly files = new Map<string, string>();
	readonly directories = new Set<string>(['/']);
	readonly writeLog: Array<{ path: string; content: string }> = [];

	constructor(files: Record<string, string>) {
		super();
		for (const [path, content] of Object.entries(files)) {
			const normalizedPath = normalizePath(path);
			this.ensureDirectory(dirname(normalizedPath));
			this.files.set(normalizedPath, content);
		}
	}

	async isDir(path: string): Promise<boolean> {
		return this.directories.has(normalizePath(path));
	}

	async fileExists(path: string): Promise<boolean> {
		return this.files.has(normalizePath(path));
	}

	async read(path: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }> {
		const content = await this.readFileAsText(path);
		const data = new TextEncoder().encode(content);
		return {
			arrayBuffer: async () => data.buffer,
		};
	}

	async readFileAsText(path: string): Promise<string> {
		const normalizedPath = normalizePath(path);
		const content = this.files.get(normalizedPath);
		if (content === undefined) {
			throw new Error(`File not found: ${normalizedPath}`);
		}
		return content;
	}

	async listFiles(path: string): Promise<string[]> {
		const normalizedPath = normalizePath(path);
		const children = new Set<string>();
		for (const directory of this.directories) {
			if (
				directory !== normalizedPath &&
				dirname(directory) === normalizedPath
			) {
				children.add(basename(directory));
			}
		}
		for (const filePath of this.files.keys()) {
			if (dirname(filePath) === normalizedPath) {
				children.add(basename(filePath));
			}
		}
		return [...children];
	}

	async writeFile(path: string, data: Uint8Array | string): Promise<void> {
		const normalizedPath = normalizePath(path);
		const content =
			typeof data === 'string' ? data : new TextDecoder().decode(data);
		this.ensureDirectory(dirname(normalizedPath));
		this.files.set(normalizedPath, content);
		this.writeLog.push({ path: normalizedPath, content });
	}

	async mkdir(path: string): Promise<void> {
		this.ensureDirectory(path);
	}

	async rmdir(path: string): Promise<void> {
		const normalizedPath = normalizePath(path);
		for (const filePath of [...this.files.keys()]) {
			if (isSameOrChildPath(normalizedPath, filePath)) {
				this.files.delete(filePath);
			}
		}
		for (const directory of [...this.directories]) {
			if (
				directory !== '/' &&
				isSameOrChildPath(normalizedPath, directory)
			) {
				this.directories.delete(directory);
			}
		}
	}

	async mv(source: string, destination: string): Promise<void> {
		const normalizedSource = normalizePath(source);
		const normalizedDestination = normalizePath(destination);
		if (this.files.has(normalizedSource)) {
			const content = this.files.get(normalizedSource) as string;
			this.ensureDirectory(dirname(normalizedDestination));
			this.files.set(normalizedDestination, content);
			this.files.delete(normalizedSource);
			return;
		}
		if (!this.directories.has(normalizedSource)) {
			throw new Error(`Path not found: ${normalizedSource}`);
		}
		const renamedFiles = [...this.files.entries()].map(
			([path, content]) =>
				[
					remapPath(path, normalizedSource, normalizedDestination),
					content,
				] as const
		);
		const renamedDirectories = [...this.directories].map((path) =>
			remapPath(path, normalizedSource, normalizedDestination)
		);
		this.files.clear();
		for (const [path, content] of renamedFiles) {
			this.files.set(path, content);
		}
		this.directories.clear();
		for (const path of renamedDirectories) {
			this.directories.add(path);
		}
	}

	async unlink(path: string): Promise<void> {
		this.files.delete(normalizePath(path));
	}

	private ensureDirectory(path: string): void {
		const normalizedPath = normalizePath(path || '/');
		const parts = normalizedPath.split('/').filter(Boolean);
		let current = '/';
		this.directories.add(current);
		for (const part of parts) {
			current = current === '/' ? `/${part}` : `${current}/${part}`;
			this.directories.add(current);
		}
	}
}

function remapPath(path: string, from: string, to: string): string {
	if (path === from) {
		return to;
	}
	if (path.startsWith(`${from}/`)) {
		return `${to}${path.slice(from.length)}`;
	}
	return path;
}

function isSameOrChildPath(parentPath: string, candidatePath: string): boolean {
	return (
		candidatePath === parentPath ||
		candidatePath.startsWith(`${parentPath}/`)
	);
}
