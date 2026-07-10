import { describe, expect, it, vi } from 'vitest';
import {
	createMethodDispatcher,
	createPlaygroundFilesystem,
} from './playground-filesystem';

describe('Playground filesystem method dispatcher', () => {
	it('routes concurrent proxy responses through one listener', async () => {
		const listeners = new Set<(message: unknown) => void>();
		const postedMessages: Array<{
			frameId: number;
			documentId: string;
			playgroundGeneration: string;
			requestId: string;
		}> = [];
		const port = {
			onMessage: {
				addListener: vi.fn((listener) => listeners.add(listener)),
				removeListener: vi.fn((listener) => listeners.delete(listener)),
			},
			postMessage: vi.fn((message) =>
				postedMessages.push(message as (typeof postedMessages)[number])
			),
		} as unknown as chrome.runtime.Port;
		const dispatcher = createMethodDispatcher(port);
		const firstFilesystem = createPlaygroundFilesystem(dispatcher, {
			frameId: 1,
			documentId: 'first-document',
			playgroundGeneration: 'first',
		});
		const secondFilesystem = createPlaygroundFilesystem(dispatcher, {
			frameId: 2,
			documentId: 'second-document',
			playgroundGeneration: 'second',
		});

		const firstResult = firstFilesystem.readFileAsText('/first.txt');
		const secondResult = secondFilesystem.readFileAsText('/second.txt');

		expect(listeners.size).toBe(1);
		expect(postedMessages).toHaveLength(2);
		expect(postedMessages[0]).toMatchObject({
			frameId: 1,
			documentId: 'first-document',
			playgroundGeneration: 'first',
		});
		expect(postedMessages[1]).toMatchObject({
			frameId: 2,
			documentId: 'second-document',
			playgroundGeneration: 'second',
		});
		expect(postedMessages[0].requestId).not.toBe(
			postedMessages[1].requestId
		);

		const [listener] = listeners;
		listener({
			type: 'METHOD_RESULT',
			requestId: postedMessages[1].requestId,
			result: 'second result',
		});
		listener({
			type: 'METHOD_RESULT',
			requestId: postedMessages[0].requestId,
			result: 'first result',
		});

		await expect(firstResult).resolves.toBe('first result');
		await expect(secondResult).resolves.toBe('second result');
		dispatcher.dispose();
	});

	it('rejects pending calls and removes its listener when disposed', async () => {
		const listeners = new Set<(message: unknown) => void>();
		const port = {
			onMessage: {
				addListener: vi.fn((listener) => listeners.add(listener)),
				removeListener: vi.fn((listener) => listeners.delete(listener)),
			},
			postMessage: vi.fn(),
		} as unknown as chrome.runtime.Port;
		const dispatcher = createMethodDispatcher(port);
		const filesystem = createPlaygroundFilesystem(dispatcher, {
			frameId: 1,
			documentId: 'document',
			playgroundGeneration: 'generation',
		});
		const pendingCall = expect(
			filesystem.readFileAsText('/pending.txt')
		).rejects.toThrow('The DevTools connection is no longer available.');

		dispatcher.dispose();

		await pendingCall;
		expect(listeners.size).toBe(0);
		await expect(
			filesystem.readFileAsText('/after-dispose.txt')
		).rejects.toThrow('The DevTools connection is no longer available.');
	});

	it('rejects pending calls without permanently blacklisting the target', async () => {
		const listeners = new Set<(message: unknown) => void>();
		const postedMessages: Array<{ requestId: string }> = [];
		const port = {
			onMessage: {
				addListener: vi.fn((listener) => listeners.add(listener)),
				removeListener: vi.fn((listener) => listeners.delete(listener)),
			},
			postMessage: vi.fn((message) =>
				postedMessages.push(message as { requestId: string })
			),
		} as unknown as chrome.runtime.Port;
		const dispatcher = createMethodDispatcher(port);
		const target = {
			frameId: 1,
			documentId: 'document',
			playgroundGeneration: 'stale-generation',
		};
		const filesystem = createPlaygroundFilesystem(dispatcher, target);
		const pendingCall = expect(
			filesystem.readFileAsText('/pending.txt')
		).rejects.toThrow(
			'The selected Playground instance is no longer available.'
		);

		dispatcher.invalidateTarget(target);

		await pendingCall;
		const futureCall = filesystem.readFileAsText('/future.txt');
		expect(postedMessages).toHaveLength(2);
		const [listener] = listeners;
		listener({
			type: 'METHOD_RESULT',
			requestId: postedMessages[1].requestId,
			result: 'current contents',
		});
		await expect(futureCall).resolves.toBe('current contents');
		dispatcher.dispose();
	});

	it('invalidates only calls from the replaced document', async () => {
		const listeners = new Set<(message: unknown) => void>();
		const postedMessages: Array<{ requestId: string }> = [];
		const port = {
			onMessage: {
				addListener: vi.fn((listener) => listeners.add(listener)),
				removeListener: vi.fn((listener) => listeners.delete(listener)),
			},
			postMessage: vi.fn((message) =>
				postedMessages.push(message as { requestId: string })
			),
		} as unknown as chrome.runtime.Port;
		const dispatcher = createMethodDispatcher(port);
		const oldTarget = {
			frameId: 1,
			documentId: 'old-document',
			playgroundGeneration: 'generation',
		};
		const currentTarget = {
			...oldTarget,
			documentId: 'current-document',
		};
		const oldFilesystem = createPlaygroundFilesystem(dispatcher, oldTarget);
		const currentFilesystem = createPlaygroundFilesystem(
			dispatcher,
			currentTarget
		);
		const oldCall = expect(
			oldFilesystem.readFileAsText('/old.txt')
		).rejects.toThrow(
			'The selected Playground instance is no longer available.'
		);
		const currentCall = currentFilesystem.readFileAsText('/current.txt');

		dispatcher.invalidateTarget(oldTarget);
		const [listener] = listeners;
		listener({
			type: 'METHOD_RESULT',
			requestId: postedMessages[1].requestId,
			result: 'current contents',
		});

		await oldCall;
		await expect(currentCall).resolves.toBe('current contents');
		dispatcher.dispose();
	});
});
