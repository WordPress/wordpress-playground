import { describe, expect, it } from 'vitest';
import { decodeGitHubBase64Content } from '../lib/github';

describe('decodeGitHubBase64Content', () => {
	it('decodes base64 content returned by the GitHub Contents API', () => {
		const bytes = decodeGitHubBase64Content(
			{ content: 'SGVs\nbG8=', encoding: 'base64' },
			'hello.txt'
		);

		expect(new TextDecoder().decode(bytes)).toBe('Hello');
	});

	it('explains when GitHub does not return inline base64 content', () => {
		expect(() =>
			decodeGitHubBase64Content(
				{ content: undefined, encoding: 'none' },
				'large-file.zip'
			)
		).toThrow(
			/GitHub did not return inline file content for large-file\.zip/
		);
	});
});
