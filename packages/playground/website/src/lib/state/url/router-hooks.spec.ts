import { confirmReloadAfterBlueprintChange, updateUrl } from './router-hooks';

const baseUrl = 'https://example.com';

describe('updateUrl', () => {
	const testCases: {
		description: string;
		input: {
			baseUrl: string;
			searchParams: Record<string, string>;
			hash: string;
		};
		expected: string;
	}[] = [
		{
			description:
				'should add the given searchParams and hash to the baseUrl',
			input: {
				baseUrl,
				searchParams: { 'site-slug': 'test-site' },
				hash: 'section1',
			},
			expected: `${baseUrl}/?site-slug=test-site#section1`,
		},
		{
			description: 'should replace hash with the given hash',
			input: {
				baseUrl: `${baseUrl}/?site-slug=first-slug#section2`,
				searchParams: { 'site-slug': 'second-slug' },
				hash: 'updated-hash',
			},
			expected: `${baseUrl}/?site-slug=second-slug#updated-hash`,
		},
		{
			description: 'should remove hash',
			input: {
				baseUrl: `${baseUrl}/?site-slug=first-slug#section2`,
				searchParams: { 'site-slug': 'second-slug' },
				hash: '',
			},
			expected: `${baseUrl}/?site-slug=second-slug`,
		},
	];

	testCases.forEach(({ description, input, expected }) => {
		it(description, () => {
			const result = updateUrl(input.baseUrl, {
				searchParams: input.searchParams,
				hash: input.hash,
			});

			expect(result).toBe(expected);
		});
	});
});

describe('confirmReloadAfterBlueprintChange', () => {
	function createWindow(confirmResult: boolean) {
		return {
			confirm: vi.fn(() => confirmResult),
			history: {
				replaceState: vi.fn(),
			},
			location: {
				reload: vi.fn(),
			},
		} as unknown as Pick<Window, 'confirm' | 'history' | 'location'>;
	}

	it('asks before reloading when only the URL hash changes', () => {
		const win = createWindow(true);

		confirmReloadAfterBlueprintChange(
			{
				oldURL: 'https://playground.test/website-server/#old',
				newURL: 'https://playground.test/website-server/#new',
			},
			win
		);

		expect(win.confirm).toHaveBeenCalledOnce();
		expect(win.location.reload).toHaveBeenCalledOnce();
		expect(win.history.replaceState).not.toHaveBeenCalled();
	});

	it('restores the previous URL when the reload is declined', () => {
		const win = createWindow(false);

		confirmReloadAfterBlueprintChange(
			{
				oldURL: 'https://playground.test/website-server/#old',
				newURL: 'https://playground.test/website-server/#new',
			},
			win
		);

		expect(win.location.reload).not.toHaveBeenCalled();
		expect(win.history.replaceState).toHaveBeenCalledWith(
			null,
			'',
			'https://playground.test/website-server/#old'
		);
	});

	it('asks before reloading without a URL Blueprint when the hash is removed', () => {
		const win = createWindow(true);

		confirmReloadAfterBlueprintChange(
			{
				oldURL: 'https://playground.test/website-server/#old',
				newURL: 'https://playground.test/website-server/',
			},
			win
		);

		expect(win.confirm).toHaveBeenCalledOnce();
		expect(win.location.reload).toHaveBeenCalledOnce();
		expect(win.history.replaceState).not.toHaveBeenCalled();
	});
});
