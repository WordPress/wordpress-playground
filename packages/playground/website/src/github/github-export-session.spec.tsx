// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
	GitHubExportSessionProvider,
	useGitHubExportSession,
} from './github-export-session';

type GitHubExportSession = ReturnType<typeof useGitHubExportSession>;

describe('GitHubExportSessionProvider', () => {
	let container: HTMLDivElement;
	let root: Root;
	let session: GitHubExportSession | undefined;

	beforeAll(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	beforeEach(() => {
		window.history.replaceState(
			null,
			'',
			'/?ghexport-repo-url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo' +
				'&ghexport-content-type=plugin&ghexport-pr-action=update' +
				'&ghexport-pr-number=7&ghexport-playground-root=%2Fwordpress' +
				'&ghexport-repo-root=%2Fplugin&ghexport-path=%2Fone' +
				'&ghexport-path=%2Ftwo&ghexport-commit-message=Export' +
				'&ghexport-plugin=example&ghexport-allow-include-zip=no'
		);
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		session = undefined;
	});

	it('initializes export form state from URL query parameters', () => {
		renderProvider();
		expect(getSession()).toMatchObject({
			allowZipExport: false,
			values: {
				repoUrl: 'https://github.com/owner/repo',
				contentType: 'plugin',
				prAction: 'update',
				prNumber: '7',
				fromPlaygroundRoot: '/wordpress',
				toPathInRepo: '/plugin',
				relativeExportPaths: ['/one', '/two'],
				commitMessage: 'Export',
				plugin: 'example',
			},
		});
	});

	it('keeps import and export state in one session', () => {
		renderProvider();
		act(() => {
			getSession().recordImport({
				url: 'https://github.com/new-owner/new-repo/pull/12',
				urlInformation: {
					type: 'pr',
					owner: 'new-owner',
					repo: 'new-repo',
					pr: 12,
				},
				branch: 'feature',
				path: '/theme',
				contentType: 'theme',
				pluginOrThemeName: 'new-theme',
				files: ['before-change'],
			});
		});

		expect(getSession().filesBeforeChanges).toEqual(['before-change']);
		expect(getSession().values).toEqual({
			repoUrl: 'https://github.com/new-owner/new-repo/pull/12',
			prNumber: '12',
			toPathInRepo: '/theme',
			prAction: 'update',
			contentType: 'theme',
			theme: 'new-theme',
		});

		act(() => {
			getSession().recordExport({
				repoUrl: 'https://github.com/new-owner/new-repo',
				prAction: 'create',
				prNumber: '',
				contentType: 'wp-content',
				toPathInRepo: '/wp-content',
				fromPlaygroundRoot: '/wordpress/wp-content',
				relativeExportPaths: ['/'],
				commitMessage: 'Export wp-content',
				includeZip: false,
			});
		});

		expect(getSession().filesBeforeChanges).toBeUndefined();
		expect(getSession().values.commitMessage).toBe('Export wp-content');
	});

	function renderProvider() {
		act(() => {
			root.render(
				<GitHubExportSessionProvider>
					<SessionProbe />
				</GitHubExportSessionProvider>
			);
		});
	}

	function SessionProbe() {
		session = useGitHubExportSession();
		return null;
	}

	function getSession() {
		if (!session) {
			throw new Error('The session probe has not rendered.');
		}
		return session;
	}
});
