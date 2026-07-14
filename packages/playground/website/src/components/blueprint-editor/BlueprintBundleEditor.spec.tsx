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
	dispatch: vi.fn(),
	resolveRuntimeConfiguration: vi.fn(),
}));

vi.mock('@php-wasm/logger', () => ({
	logger: { error: vi.fn() },
}));

vi.mock('@wp-playground/blueprints', () => ({
	resolveRuntimeConfiguration: mocks.resolveRuntimeConfiguration,
}));

vi.mock('@wp-playground/components', async () => {
	const { forwardRef } = await import('react');
	return {
		CodeEditor: forwardRef(
			(props: { onChange: (code: string) => void }, _ref) => {
				mocks.changeCode = props.onChange;
				return null;
			}
		),
		FileExplorerSidebar: () => null,
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
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
		writeFile = vi.fn();
		filesystem = {
			readFileAsText: vi.fn().mockResolvedValue('{}'),
			writeFile,
		} as unknown as AsyncWritableFilesystem;
		mocks.changeCode = undefined;
		mocks.dispatch.mockReset();
		mocks.resolveRuntimeConfiguration.mockReset();
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it('does not recreate when the pending edit cannot be saved', async () => {
		let failWrite!: (error: Error) => void;
		writeFile.mockReturnValue(
			new Promise<void>((_resolve, reject) => {
				failWrite = reject;
			})
		);
		const editorRef = await renderEditor();
		act(() => mocks.changeCode!(EDITED_BLUEPRINT));

		let recreate!: Promise<void>;
		act(() => {
			recreate = editorRef.current!.triggerRecreate();
		});
		await act(async () => Promise.resolve());

		expect(writeFile).toHaveBeenCalledOnce();
		expect(writeFile).toHaveBeenCalledWith(
			'/blueprint.json',
			EDITED_BLUEPRINT
		);
		expect(mocks.resolveRuntimeConfiguration).not.toHaveBeenCalled();

		await act(async () => {
			failWrite(new Error('disk full'));
			await recreate;
		});

		expect(mocks.resolveRuntimeConfiguration).not.toHaveBeenCalled();
		expect(mocks.dispatch).not.toHaveBeenCalled();
		expect(container.textContent).toContain(
			'Could not save changes. Try again.'
		);
	});

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
		return editorRef;
	}
});
