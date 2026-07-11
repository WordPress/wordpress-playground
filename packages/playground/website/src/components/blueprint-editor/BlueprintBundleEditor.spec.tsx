// @vitest-environment jsdom

import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import {
	BlueprintBundleEditor,
	type BlueprintBundleEditorHandle,
} from './BlueprintBundleEditor';

const EDITED_BLUEPRINT = '{"steps":[{"step":"login"}]}';
const mocks = vi.hoisted(() => ({
	changeCode: undefined as ((code: string) => void) | undefined,
	codeEditorPath: null as string | null,
	codeEditorReadOnly: false,
	dispatch: vi.fn(),
	fileExplorerReadOnly: false,
	loggerError: vi.fn(),
	openFile: undefined as
		| ((path: string, content: string, shouldFocus?: boolean) => void)
		| undefined,
	resolveRuntimeConfiguration: vi.fn(),
}));

vi.mock('@php-wasm/logger', () => ({
	logger: { error: mocks.loggerError },
}));

vi.mock('@wp-playground/blueprints', () => ({
	resolveRuntimeConfiguration: mocks.resolveRuntimeConfiguration,
}));

vi.mock('@wp-playground/components', async () => {
	const { forwardRef } = await import('react');
	return {
		CodeEditor: forwardRef(
			(
				props: {
					currentPath: string | null;
					onChange: (code: string) => void;
					readOnly?: boolean;
				},
				_ref
			) => {
				mocks.changeCode = props.onChange;
				mocks.codeEditorPath = props.currentPath;
				mocks.codeEditorReadOnly = Boolean(props.readOnly);
				return null;
			}
		),
		FileExplorerSidebar: (props: {
			onFileOpened: (
				path: string,
				content: string,
				shouldFocus?: boolean
			) => void;
			readOnly?: boolean;
		}) => {
			mocks.fileExplorerReadOnly = Boolean(props.readOnly);
			mocks.openFile = props.onFileOpened;
			return null;
		},
	};
});

vi.mock('../../lib/hooks/use-blueprint-url-hash', () => ({
	useBlueprintUrlHash: () => ({ isShareable: true, urlHash: '' }),
}));

vi.mock('../../lib/state/redux/store', () => ({
	useAppDispatch: () => mocks.dispatch,
	useAppSelector: () => undefined,
}));

describe('BlueprintBundleEditor Run barrier', () => {
	let container: HTMLDivElement;
	let root: Root;
	let filesystem: AsyncWritableFilesystem;
	let writeFile: ReturnType<typeof vi.fn>;
	const site = {
		metadata: {
			initialOpfsSyncPending: false,
			originalBlueprint: null,
			storage: 'none',
		},
		slug: 'test-site',
	} as SiteInfo;

	beforeAll(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	beforeEach(() => {
		vi.useFakeTimers();
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
		writeFile = vi.fn().mockResolvedValue(undefined);
		filesystem = {
			readFileAsText: vi.fn().mockResolvedValue('{}'),
			writeFile,
		} as unknown as AsyncWritableFilesystem;
		mocks.changeCode = undefined;
		mocks.codeEditorPath = null;
		mocks.dispatch.mockReset();
		mocks.loggerError.mockReset();
		mocks.resolveRuntimeConfiguration.mockReset();
		mocks.resolveRuntimeConfiguration.mockResolvedValue({});
		mocks.openFile = undefined;
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('saves the pending edit before resolving and dispatching the recreation', async () => {
		let finishWrite!: () => void;
		writeFile.mockReturnValue(
			new Promise<void>((resolve) => {
				finishWrite = resolve;
			})
		);
		const editorRef = await renderEditor();
		changeCode('{"steps":[]}');
		changeCode(EDITED_BLUEPRINT);

		let recreate!: Promise<void>;
		act(() => {
			recreate = editorRef.current!.triggerRecreate();
		});
		await act(async () => Promise.resolve());

		expect(writeFile).toHaveBeenCalledWith(
			'/blueprint.json',
			EDITED_BLUEPRINT
		);
		expect(writeFile).toHaveBeenCalledOnce();
		expect(mocks.resolveRuntimeConfiguration).not.toHaveBeenCalled();
		expect(mocks.dispatch).not.toHaveBeenCalled();
		expect(mocks.codeEditorReadOnly).toBe(true);
		expect(mocks.fileExplorerReadOnly).toBe(true);

		finishWrite();
		await act(async () => recreate);

		expect(mocks.resolveRuntimeConfiguration).toHaveBeenCalledWith(
			filesystem
		);
		expect(mocks.dispatch).toHaveBeenCalledTimes(2);
		act(() => vi.advanceTimersByTime(201));
		expect(writeFile).toHaveBeenCalledOnce();
	});

	it('retries a failed save after the user navigates to another file', async () => {
		writeFile.mockRejectedValueOnce(new Error('disk full'));
		const editorRef = await renderEditor();
		changeCode(EDITED_BLUEPRINT);

		await act(async () => editorRef.current!.triggerRecreate());

		expect(mocks.resolveRuntimeConfiguration).not.toHaveBeenCalled();
		expect(mocks.dispatch).not.toHaveBeenCalled();
		expect(container.textContent).toContain(
			'Could not save changes. Try again.'
		);
		openFile('/notes.txt', 'notes');
		expect(mocks.codeEditorPath).toBe('/notes.txt');

		await act(async () => editorRef.current!.triggerRecreate());

		expect(writeFile).toHaveBeenCalledTimes(2);
		expect(writeFile).toHaveBeenNthCalledWith(
			2,
			'/blueprint.json',
			EDITED_BLUEPRINT
		);
		expect(mocks.codeEditorPath).toBe('/notes.txt');
		expect(mocks.resolveRuntimeConfiguration).toHaveBeenCalledOnce();
		expect(mocks.dispatch).toHaveBeenCalledTimes(2);
	});

	/** Renders an editable Blueprint and waits for its initial file read. */
	async function renderEditor(): Promise<
		React.RefObject<BlueprintBundleEditorHandle>
	> {
		const editorRef = createRef<BlueprintBundleEditorHandle>();
		await act(async () => {
			root.render(
				<BlueprintBundleEditor
					ref={editorRef}
					filesystem={filesystem}
					site={site}
				/>
			);
			await Promise.resolve();
		});
		expect(editorRef.current).not.toBeNull();
		expect(mocks.changeCode).toBeTypeOf('function');
		expect(mocks.openFile).toBeTypeOf('function');
		return editorRef;
	}

	/** Delivers a source change through the mocked CodeEditor. */
	function changeCode(code: string): void {
		act(() => mocks.changeCode!(code));
	}

	/** Opens a file through the mocked FileExplorerSidebar. */
	function openFile(path: string, content: string): void {
		act(() => mocks.openFile!(path, content));
	}
});
