import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { broadcastAppUpdate, openAppUpdateChannel } from './update-channel';

type MessageHandler = (event: MessageEvent) => void;

class MockBroadcastChannel {
	static instances: MockBroadcastChannel[] = [];
	name: string;
	onmessage: MessageHandler | null = null;
	closed = false;
	messages: unknown[] = [];

	constructor(name: string) {
		this.name = name;
		MockBroadcastChannel.instances.push(this);
	}

	postMessage(data: unknown): void {
		if (this.closed) {
			return;
		}

		this.messages.push(data);
		const event = { data } as MessageEvent;
		for (const instance of MockBroadcastChannel.instances) {
			if (
				instance !== this &&
				instance.name === this.name &&
				!instance.closed
			) {
				instance.onmessage?.(event);
			}
		}
	}

	close(): void {
		this.closed = true;
		const index = MockBroadcastChannel.instances.indexOf(this);
		if (index !== -1) {
			MockBroadcastChannel.instances.splice(index, 1);
		}
	}

	static reset(): void {
		MockBroadcastChannel.instances = [];
	}
}

describe('app update channel', () => {
	beforeEach(() => {
		MockBroadcastChannel.reset();
		vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
	});

	afterEach(() => {
		MockBroadcastChannel.reset();
		vi.unstubAllGlobals();
	});

	it('broadcasts update availability to other tabs', () => {
		const onUpdateAvailable = vi.fn();
		const sender = openAppUpdateChannel('sender', vi.fn());
		const receiver = openAppUpdateChannel('receiver', onUpdateAvailable);

		broadcastAppUpdate(sender, 'sender', 'new-build');

		expect(receiver).not.toBeNull();
		expect(onUpdateAvailable).toHaveBeenCalledWith('new-build');
	});

	it('ignores messages from the same tab', () => {
		const onUpdateAvailable = vi.fn();
		const channel = openAppUpdateChannel('sender', onUpdateAvailable);

		MockBroadcastChannel.instances[0].onmessage?.({
			data: {
				type: 'update-available',
				deployedVersion: 'new-build',
				senderId: 'sender',
			},
		} as MessageEvent);

		expect(channel).not.toBeNull();
		expect(onUpdateAvailable).not.toHaveBeenCalled();
	});

	it('ignores unrelated messages', () => {
		const onUpdateAvailable = vi.fn();
		openAppUpdateChannel('sender', onUpdateAvailable);

		MockBroadcastChannel.instances[0].onmessage?.({
			data: {
				type: 'something-else',
				deployedVersion: 'new-build',
				senderId: 'other',
			},
		} as MessageEvent);

		expect(onUpdateAvailable).not.toHaveBeenCalled();
	});

	it('returns null when BroadcastChannel is unavailable', () => {
		vi.stubGlobal('BroadcastChannel', undefined);

		expect(openAppUpdateChannel('sender', vi.fn())).toBeNull();
	});
});
