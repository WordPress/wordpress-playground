import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	initCrossTabSync,
	destroyCrossTabSync,
	broadcastMetadataUpdate,
	isFromBroadcast,
} from './cross-tab-sync';
import { sitesSlice } from './slice-sites';

// Mock slice-sites to avoid browser dependencies from slice-ui
vi.mock('./slice-sites', () => ({
	sitesSlice: {
		actions: {
			updateSiteMetadata: vi.fn((payload) => ({
				type: 'sites/updateSiteMetadata',
				payload,
			})),
		},
	},
}));

type MessageHandler = (event: MessageEvent) => void;

class MockBroadcastChannel {
	static instances: MockBroadcastChannel[] = [];
	name: string;
	onmessage: MessageHandler | null = null;
	closed = false;

	constructor(name: string) {
		this.name = name;
		MockBroadcastChannel.instances.push(this);
	}

	postMessage(data: unknown): void {
		if (this.closed) return;

		const event = { data } as MessageEvent;
		for (const instance of MockBroadcastChannel.instances) {
			if (
				instance !== this &&
				instance.name === this.name &&
				!instance.closed
			) {
				if (instance.onmessage) {
					instance.onmessage(event);
				}
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

describe('cross-tab-sync', () => {
	let mockDispatch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		MockBroadcastChannel.reset();
		vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
		vi.stubGlobal('crypto', {
			randomUUID: () =>
				`test-uuid-${Math.random().toString(36).slice(2)}`,
		});
		mockDispatch = vi.fn();
		destroyCrossTabSync();
	});

	afterEach(() => {
		destroyCrossTabSync();
		MockBroadcastChannel.reset();
		vi.unstubAllGlobals();
	});

	describe('initCrossTabSync', () => {
		it('creates a BroadcastChannel', () => {
			initCrossTabSync(mockDispatch);
			expect(MockBroadcastChannel.instances).toHaveLength(1);
			expect(MockBroadcastChannel.instances[0].name).toBe(
				'playground-site-metadata-sync'
			);
		});

		it('does not create duplicate channels on multiple calls', () => {
			initCrossTabSync(mockDispatch);
			initCrossTabSync(mockDispatch);
			expect(MockBroadcastChannel.instances).toHaveLength(1);
		});
	});

	describe('destroyCrossTabSync', () => {
		it('closes the channel', () => {
			initCrossTabSync(mockDispatch);
			expect(MockBroadcastChannel.instances).toHaveLength(1);

			destroyCrossTabSync();
			expect(MockBroadcastChannel.instances).toHaveLength(0);
		});

		it('does not throw when not initialized', () => {
			expect(() => destroyCrossTabSync()).not.toThrow();
		});
	});

	describe('broadcastMetadataUpdate', () => {
		it('broadcasts syncable fields', () => {
			initCrossTabSync(mockDispatch);

			const messages: unknown[] = [];
			const otherChannel = new MockBroadcastChannel(
				'playground-site-metadata-sync'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				messages.push(event.data);
			};

			broadcastMetadataUpdate('my-site', {
				backupHistory: [{ timestamp: 123, filename: 'backup-123.zip' }],
				lastAccessDate: 999,
			});

			expect(messages).toHaveLength(1);
			const message = messages[0] as {
				type: string;
				slug: string;
				changes: Record<string, unknown>;
				senderId: string;
			};
			expect(message.type).toBe('metadata-update');
			expect(message.slug).toBe('my-site');
			expect(message.changes).toEqual({
				backupHistory: [{ timestamp: 123, filename: 'backup-123.zip' }],
				lastAccessDate: 999,
			});
			expect(message.senderId).toBeTruthy();

			otherChannel.close();
		});

		it('filters out non-syncable fields', () => {
			initCrossTabSync(mockDispatch);

			const messages: unknown[] = [];
			const otherChannel = new MockBroadcastChannel(
				'playground-site-metadata-sync'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				messages.push(event.data);
			};

			broadcastMetadataUpdate('my-site', {
				backupHistory: [{ timestamp: 123, filename: 'backup-123.zip' }],
				name: 'should-not-sync',
				storage: 'opfs',
				whenCreated: 12345,
			} as Record<string, unknown>);

			expect(messages).toHaveLength(1);
			const message = messages[0] as {
				changes: Record<string, unknown>;
			};
			expect(message.changes).toEqual({
				backupHistory: [{ timestamp: 123, filename: 'backup-123.zip' }],
			});
			expect(message.changes).not.toHaveProperty('name');
			expect(message.changes).not.toHaveProperty('storage');
			expect(message.changes).not.toHaveProperty('whenCreated');

			otherChannel.close();
		});

		it('does not broadcast when no syncable fields', () => {
			initCrossTabSync(mockDispatch);

			const messages: unknown[] = [];
			const otherChannel = new MockBroadcastChannel(
				'playground-site-metadata-sync'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				messages.push(event.data);
			};

			broadcastMetadataUpdate('my-site', {
				name: 'not-syncable',
				whenCreated: 12345,
			} as Record<string, unknown>);

			expect(messages).toHaveLength(0);

			otherChannel.close();
		});

		it('does not broadcast when not initialized', () => {
			const messages: unknown[] = [];
			const otherChannel = new MockBroadcastChannel(
				'playground-site-metadata-sync'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				messages.push(event.data);
			};

			broadcastMetadataUpdate('my-site', {
				backupHistory: [],
			});

			expect(messages).toHaveLength(0);

			otherChannel.close();
		});
	});

	describe('receiving metadata updates', () => {
		it('dispatches updateSiteMetadata action when receiving updates', () => {
			initCrossTabSync(mockDispatch);

			const otherChannel = new MockBroadcastChannel(
				'playground-site-metadata-sync'
			);
			otherChannel.postMessage({
				type: 'metadata-update',
				slug: 'my-site',
				changes: {
					backupHistory: [
						{ timestamp: 456, filename: 'backup-456.zip' },
					],
				},
				senderId: 'other-sender',
			});

			expect(mockDispatch).toHaveBeenCalledWith(
				sitesSlice.actions.updateSiteMetadata({
					slug: 'my-site',
					metadata: {
						backupHistory: [
							{ timestamp: 456, filename: 'backup-456.zip' },
						],
					},
				})
			);

			otherChannel.close();
		});

		it('ignores messages from self', () => {
			initCrossTabSync(mockDispatch);

			broadcastMetadataUpdate('my-site', {
				backupHistory: [],
			});

			expect(mockDispatch).not.toHaveBeenCalled();
		});

		it('does not dispatch when dispatch is not set', () => {
			destroyCrossTabSync();

			const otherChannel = new MockBroadcastChannel(
				'playground-site-metadata-sync'
			);

			initCrossTabSync(mockDispatch);
			destroyCrossTabSync();

			otherChannel.postMessage({
				type: 'metadata-update',
				slug: 'my-site',
				changes: { backupHistory: [] },
				senderId: 'other-sender',
			});

			expect(mockDispatch).not.toHaveBeenCalled();

			otherChannel.close();
		});
	});

	describe('isFromBroadcast', () => {
		it('returns false normally', () => {
			initCrossTabSync(mockDispatch as never);
			expect(isFromBroadcast()).toBe(false);
		});

		it('returns true while processing broadcast', () => {
			let wasFromBroadcast = false;
			const trackingDispatch = vi.fn(() => {
				wasFromBroadcast = isFromBroadcast();
			});

			initCrossTabSync(trackingDispatch as never);

			const otherChannel = new MockBroadcastChannel(
				'playground-site-metadata-sync'
			);
			otherChannel.postMessage({
				type: 'metadata-update',
				slug: 'my-site',
				changes: { backupHistory: [] },
				senderId: 'other-sender',
			});

			expect(wasFromBroadcast).toBe(true);
			expect(isFromBroadcast()).toBe(false);

			otherChannel.close();
		});
	});

	describe('loop prevention', () => {
		it('does not re-broadcast while processing incoming broadcast', () => {
			const messages: unknown[] = [];

			const rebroadcastingDispatch = vi.fn(() => {
				broadcastMetadataUpdate('my-site', {
					lastAccessDate: Date.now(),
				});
			});

			initCrossTabSync(rebroadcastingDispatch as never);

			const otherChannel = new MockBroadcastChannel(
				'playground-site-metadata-sync'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				messages.push(event.data);
			};

			otherChannel.postMessage({
				type: 'metadata-update',
				slug: 'my-site',
				changes: { backupHistory: [] },
				senderId: 'other-sender',
			});

			expect(rebroadcastingDispatch).toHaveBeenCalled();
			expect(messages).toHaveLength(0);

			otherChannel.close();
		});
	});
});
