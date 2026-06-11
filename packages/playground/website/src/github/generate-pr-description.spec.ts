import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Changeset } from '@wp-playground/storage';
import { generatePrDescription } from './generate-pr-description';

function makeChangeset(partial: Partial<Changeset> = {}): Changeset {
	return {
		create: new Map(),
		update: new Map(),
		delete: new Set(),
		...partial,
	};
}

function mockOpenAIResponse(content: string) {
	return {
		ok: true,
		json: async () => ({
			choices: [
				{
					message: { content },
				},
			],
		}),
	};
}

describe('generatePrDescription', () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		global.fetch = fetchMock;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return null if no API key is provided', async () => {
		const result = await generatePrDescription(
			makeChangeset(),
			undefined,
			'wp-content'
		);

		expect(result).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('should return null if the API key is an empty string', async () => {
		const result = await generatePrDescription(
			makeChangeset(),
			'',
			'wp-content'
		);

		expect(result).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('should return null if the API key is whitespace only', async () => {
		const result = await generatePrDescription(
			makeChangeset(),
			'   ',
			'wp-content'
		);

		expect(result).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('should call the OpenAI API with correct parameters', async () => {
		const changeset = makeChangeset({
			create: new Map([['wp-content/file.txt', new Uint8Array()]]),
			update: new Map([['wp-content/existing.txt', new Uint8Array()]]),
		});

		fetchMock.mockResolvedValueOnce(
			mockOpenAIResponse(
				JSON.stringify({
					title: 'Update wp-content files',
					body: 'This PR updates the wp-content directory with new files.',
				})
			)
		);

		const result = await generatePrDescription(
			changeset,
			'sk-test-key',
			'wp-content'
		);

		expect(result).toEqual({
			title: 'Update wp-content files',
			body: 'This PR updates the wp-content directory with new files.',
		});

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.openai.com/v1/chat/completions',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'Content-Type': 'application/json',
					Authorization: 'Bearer sk-test-key',
				}),
			})
		);
	});

	it('should only send file paths to the API, never file contents', async () => {
		const secretContent = new TextEncoder().encode('TOP-SECRET-VALUE');
		const changeset = makeChangeset({
			update: new Map([['wp-config.php', secretContent]]),
		});

		fetchMock.mockResolvedValueOnce(
			mockOpenAIResponse(
				JSON.stringify({ title: 'Title', body: 'Body.' })
			)
		);

		await generatePrDescription(changeset, 'sk-test-key', 'wp-content');

		const requestBody = fetchMock.mock.calls[0][1]?.body as string;
		expect(requestBody).toContain('wp-config.php');
		expect(requestBody).not.toContain('TOP-SECRET-VALUE');
	});

	it('should return null if the API returns a non-ok status', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: false,
			status: 401,
			statusText: 'Unauthorized',
		});

		const result = await generatePrDescription(
			makeChangeset({
				create: new Map([['file.txt', new Uint8Array()]]),
			}),
			'sk-invalid-key',
			'plugin'
		);

		expect(result).toBeNull();
	});

	it('should return null if the API response is malformed', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ unexpected: 'format' }),
		});

		const result = await generatePrDescription(
			makeChangeset({
				create: new Map([['file.txt', new Uint8Array()]]),
			}),
			'sk-test-key',
			'plugin'
		);

		expect(result).toBeNull();
	});

	it('should return null if fetch throws an error', async () => {
		fetchMock.mockRejectedValueOnce(new Error('Network error'));

		const result = await generatePrDescription(
			makeChangeset({
				create: new Map([['file.txt', new Uint8Array()]]),
			}),
			'sk-test-key',
			'theme'
		);

		expect(result).toBeNull();
	});

	it('should handle a plain text response when JSON parsing fails', async () => {
		fetchMock.mockResolvedValueOnce(
			mockOpenAIResponse(
				`"Update theme files"\nThis PR updates the theme with new styles.`
			)
		);

		const result = await generatePrDescription(
			makeChangeset({
				create: new Map([['file.txt', new Uint8Array()]]),
			}),
			'sk-test-key',
			'theme'
		);

		expect(result).toEqual({
			title: 'Update theme files',
			body: 'This PR updates the theme with new styles.',
		});
	});

	it('should include the content type context in the prompt', async () => {
		fetchMock.mockResolvedValueOnce(
			mockOpenAIResponse(
				JSON.stringify({
					title: 'Update plugin code',
					body: 'Plugin update with improvements.',
				})
			)
		);

		await generatePrDescription(
			makeChangeset({
				update: new Map([['my-plugin/plugin.php', new Uint8Array()]]),
			}),
			'sk-test-key',
			'plugin'
		);

		const callArgs = fetchMock.mock.calls[0][1];
		const body = JSON.parse(callArgs?.body as string);
		expect(body.messages[0].content).toContain(
			'Updating a WordPress plugin'
		);
	});

	it('should truncate long file lists in the prompt', async () => {
		const manyFiles = new Map(
			Array.from({ length: 25 }, (_, i) => [
				`wp-content/file-${i}.txt`,
				new Uint8Array(),
			])
		);

		fetchMock.mockResolvedValueOnce(
			mockOpenAIResponse(
				JSON.stringify({ title: 'Title', body: 'Body.' })
			)
		);

		await generatePrDescription(
			makeChangeset({ create: manyFiles }),
			'sk-test-key',
			'wp-content'
		);

		const requestBody = fetchMock.mock.calls[0][1]?.body as string;
		const prompt = JSON.parse(requestBody).messages[0].content;
		expect(prompt).toContain('25 total, showing first 10');
		expect(prompt).toContain('... and 15 more');
		expect(prompt).not.toContain('file-15.txt');
	});
});
