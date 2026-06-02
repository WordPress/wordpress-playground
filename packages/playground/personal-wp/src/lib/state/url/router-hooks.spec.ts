import { updateUrl } from './router-hooks';

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
