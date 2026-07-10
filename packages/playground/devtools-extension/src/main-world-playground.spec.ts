import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	detectPlaygroundInMainWorld,
	executePlaygroundMethodInMainWorld,
} from './main-world-playground';

const stateKey = '@wp-playground/devtools-extension/test-generation';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('main-world Playground generations', () => {
	it('keeps the generation stable for the same Playground object', () => {
		const playground = { documentRoot: '/wordpress' };
		vi.stubGlobal('window', { playground });

		const first = detectPlaygroundInMainWorld(stateKey);
		const second = detectPlaygroundInMainWorld(stateKey);

		expect(first).toEqual(second);
		expect(first.playgroundGeneration).toMatch(/^[0-9a-f]{32}$/);
	});

	it('rejects an old generation after the Playground object changes', async () => {
		const originalMethod = vi.fn(async () => 'original');
		const replacementMethod = vi.fn(async () => 'replacement');
		vi.stubGlobal('window', {
			playground: { readFileAsText: originalMethod },
		});
		const original = detectPlaygroundInMainWorld(stateKey);

		(
			window as unknown as {
				playground: { readFileAsText: () => unknown };
			}
		).playground = { readFileAsText: replacementMethod };
		const staleResult = await executePlaygroundMethodInMainWorld(
			'readFileAsText',
			['/index.php'],
			original.playgroundGeneration!,
			stateKey
		);

		expect(staleResult).toEqual({
			error: 'The selected Playground instance is no longer available.',
		});
		expect(originalMethod).not.toHaveBeenCalled();
		expect(replacementMethod).not.toHaveBeenCalled();

		const replacement = detectPlaygroundInMainWorld(stateKey);
		expect(replacement.playgroundGeneration).not.toBe(
			original.playgroundGeneration
		);
		expect(
			await executePlaygroundMethodInMainWorld(
				'readFileAsText',
				['/index.php'],
				replacement.playgroundGeneration!,
				stateKey
			)
		).toEqual({ result: 'replacement' });
	});

	it('rejects an old generation in a replacement document', async () => {
		const playground = { readFileAsText: vi.fn(async () => 'contents') };
		vi.stubGlobal('window', { playground });
		const original = detectPlaygroundInMainWorld(stateKey);

		vi.stubGlobal('window', { playground });

		expect(
			await executePlaygroundMethodInMainWorld(
				'readFileAsText',
				['/index.php'],
				original.playgroundGeneration!,
				stateKey
			)
		).toEqual({
			error: 'The selected Playground instance is no longer available.',
		});
		expect(playground.readFileAsText).not.toHaveBeenCalled();
	});
});
