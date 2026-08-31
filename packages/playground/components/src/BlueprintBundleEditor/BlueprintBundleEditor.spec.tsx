// @vitest-environment jsdom

import React, { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
	EventedFilesystem,
	InMemoryFilesystemBackend,
} from '@wp-playground/storage';
import {
	BlueprintBundleEditor,
	type BlueprintBundleEditorHandle,
} from './BlueprintBundleEditor';
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
	changeCode: undefined as ((code: string) => void) | undefined,
	codeEditorProps: undefined as Record<string, unknown> | undefined,
	fileExplorerProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock('../PlaygroundFileEditor', async () => {
	const { forwardRef } = await import('react');
	return {
		CodeEditor: forwardRef(
			(props: { onChange: (code: string) => void }, _ref) => {
				mocks.changeCode = props.onChange;
				mocks.codeEditorProps = props as unknown as Record<
					string,
					unknown
				>;
				return null;
			}
		),
		FileExplorerSidebar: (props: Record<string, unknown>) => {
			mocks.fileExplorerProps = props;
			return null;
		},
	};
});

describe('BlueprintBundleEditor', () => {
	let container: HTMLDivElement;
	let root: Root;
	let filesystem: EventedFilesystem;

	beforeAll(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	beforeEach(async () => {
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
		filesystem = new EventedFilesystem(new InMemoryFilesystemBackend());
		await filesystem.writeFile('/blueprint.json', '{"steps":[]}');
		mocks.changeCode = undefined;
		mocks.codeEditorProps = undefined;
		mocks.fileExplorerProps = undefined;
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it('saves the latest edit before requesting a preview', async () => {
		let blueprintAtPreview = '';
		const onPreview = vi.fn(
			async (previewFilesystem: EventedFilesystem) => {
				blueprintAtPreview =
					await previewFilesystem.readFileAsText('/blueprint.json');
			}
		);
		const editorRef = await renderEditor({ onPreview });

		act(() => mocks.changeCode?.('{"steps":[{"step":"login"}]}'));
		await act(async () => editorRef.current?.preview());

		expect(onPreview).toHaveBeenCalledOnce();
		expect(blueprintAtPreview).toBe('{"steps":[{"step":"login"}]}');
	});

	it('does not preview when the pending edit cannot be saved', async () => {
		vi.spyOn(filesystem, 'writeFile').mockRejectedValueOnce(
			new Error('disk full')
		);
		const onPreview = vi.fn();
		const editorRef = await renderEditor({ onPreview });

		act(() => mocks.changeCode?.('{"steps":[{"step":"login"}]}'));
		await act(async () => editorRef.current?.preview());

		expect(onPreview).not.toHaveBeenCalled();
		expect(container.textContent).toContain(
			'Could not save changes. Try again.'
		);
	});

	it('reports changes made through the shared filesystem', async () => {
		const onChange = vi.fn();
		await renderEditor({ onChange });

		await act(async () => filesystem.mkdir('/assets'));

		expect(onChange).toHaveBeenCalledWith(filesystem);
	});

	it('keeps both the file tree and code editor read-only', async () => {
		await renderEditor({ readOnly: true });

		expect(mocks.fileExplorerProps?.['readOnly']).toBe(true);
		expect(mocks.codeEditorProps?.['readOnly']).toBe(true);
		act(() => mocks.changeCode?.('{"steps":[{"step":"login"}]}'));
		expect(await filesystem.readFileAsText('/blueprint.json')).toBe(
			'{"steps":[]}'
		);
	});

	async function renderEditor(
		props: {
			readOnly?: boolean;
			onChange?: (changedFilesystem: EventedFilesystem) => void;
			onPreview?: (
				previewFilesystem: EventedFilesystem
			) => void | Promise<void>;
		} = {}
	): Promise<React.RefObject<BlueprintBundleEditorHandle>> {
		const editorRef = createRef<BlueprintBundleEditorHandle>();
		await act(async () => {
			root.render(
				<BlueprintBundleEditor
					ref={editorRef}
					filesystem={filesystem}
					{...props}
				/>
			);
			await Promise.resolve();
		});
		expect(editorRef.current).not.toBeNull();
		expect(mocks.changeCode).toBeTypeOf('function');
		return editorRef;
	}
});
