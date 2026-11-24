// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PlaygroundClient } from '@wp-playground/client';
import GitHubImportForm from './form';
import { oAuthState } from '../state';

const { iterator, listForAuthenticatedUser } = vi.hoisted(() => ({
	iterator: vi.fn(),
	listForAuthenticatedUser: vi.fn(),
}));

vi.mock('../client', () => ({
	getAuthenticatedGitHubClient: () => ({
		paginate: { iterator },
		rest: { repos: { listForAuthenticatedUser } },
	}),
}));

vi.mock('../github-oauth-guard', () => ({
	default: ({ children }: { children: React.ReactNode }) => children,
}));

// The contract is account-scoped, paginated suggestions. Pagination and late
// responses from a previous account can otherwise omit repos or leak stale suggestions.
describe('GitHub import repository suggestions', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));
	afterAll(() => vi.unstubAllGlobals());
	beforeEach(() => {
		iterator.mockReset();
		oAuthState.value = { token: '', isAuthorizing: false };
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
	});
	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		oAuthState.value = { token: '', isAuthorizing: false };
	});

	async function render(token: string) {
		await act(async () => {
			oAuthState.value = { token, isAuthorizing: false };
			root.render(
				<GitHubImportForm
					playground={{} as PlaygroundClient}
					onImported={() => {}}
					onClose={() => {}}
				/>
			);
		});
	}

	it('loads all pages for a connected account and uses importable URLs', async () => {
		iterator.mockImplementation(async function* () {
			yield {
				data: [
					{
						full_name: 'owner/first',
						html_url: 'https://github.com/owner/first',
					},
				],
			};
			yield {
				data: [
					{
						full_name: 'owner/second',
						html_url: 'https://github.com/owner/second',
					},
				],
			};
		});
		await render('connected');
		expect(iterator).toHaveBeenCalledWith(listForAuthenticatedUser, {
			sort: 'updated',
			per_page: 100,
		});
		expect(
			Array.from(
				container.querySelectorAll('datalist option'),
				(option) => (option as HTMLOptionElement).value
			)
		).toEqual([
			'https://github.com/owner/first',
			'https://github.com/owner/second',
		]);
	});

	it('does not request repositories without a connected account', async () => {
		await render('');
		expect(iterator).not.toHaveBeenCalled();
	});

	it('discards repository responses after the account disconnects', async () => {
		let resolvePage!: (value: unknown) => void;
		const page = new Promise((resolve) => {
			resolvePage = resolve;
		});
		iterator.mockImplementation(async function* () {
			yield await page;
		});
		await render('connected');
		await render('');
		await act(async () => {
			resolvePage({
				data: [
					{
						full_name: 'old/repo',
						html_url: 'https://github.com/old/repo',
					},
				],
			});
		});
		expect(container.querySelector('datalist option')).toBeNull();
	});
});
