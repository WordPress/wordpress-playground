import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	initTabCoordinator,
	destroyTabCoordinator,
	getCurrentTabInfo,
	isTabStale,
	setDependentMode,
	checkForExistingTabs,
	requestStaleTabsShutdown,
	requestTakeover,
	requestRemoteBackup,
	broadcastSiteReset,
	setBackupRequestCallback,
	type TabInfo,
} from './tab-coordinator';

type MessageHandler = (event: MessageEvent) => void;

class MockBroadcastChannel {
	static instances: MockBroadcastChannel[] = [];
	name: string;
	onmessage: MessageHandler | null = null;
	private listeners: Map<string, MessageHandler[]> = new Map();
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
				const listeners = instance.listeners.get('message') || [];
				for (const listener of listeners) {
					listener(event);
				}
			}
		}
	}

	addEventListener(type: string, handler: MessageHandler): void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, []);
		}
		this.listeners.get(type)!.push(handler);
	}

	removeEventListener(type: string, handler: MessageHandler): void {
		const handlers = this.listeners.get(type);
		if (handlers) {
			const index = handlers.indexOf(handler);
			if (index !== -1) {
				handlers.splice(index, 1);
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

describe('tab-coordinator', () => {
	beforeEach(() => {
		MockBroadcastChannel.reset();
		vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
		vi.stubGlobal('crypto', {
			randomUUID: () =>
				`test-uuid-${Math.random().toString(36).slice(2)}`,
		});
		destroyTabCoordinator();
	});

	afterEach(() => {
		destroyTabCoordinator();
		MockBroadcastChannel.reset();
		vi.unstubAllGlobals();
	});

	describe('isTabStale', () => {
		it('returns false for tabs created just now', () => {
			const tabInfo: TabInfo = {
				tabId: 'test-tab',
				createdAt: Date.now(),
				siteSlug: 'test-site',
			};
			expect(isTabStale(tabInfo)).toBe(false);
		});

		it('returns false for tabs created 23 hours ago', () => {
			const twentyThreeHoursAgo = Date.now() - 23 * 60 * 60 * 1000;
			const tabInfo: TabInfo = {
				tabId: 'test-tab',
				createdAt: twentyThreeHoursAgo,
				siteSlug: 'test-site',
			};
			expect(isTabStale(tabInfo)).toBe(false);
		});

		it('returns true for tabs created exactly 24 hours ago', () => {
			const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
			const tabInfo: TabInfo = {
				tabId: 'test-tab',
				createdAt: oneDayAgo,
				siteSlug: 'test-site',
			};
			expect(isTabStale(tabInfo)).toBe(true);
		});

		it('returns true for tabs created more than 24 hours ago', () => {
			const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
			const tabInfo: TabInfo = {
				tabId: 'test-tab',
				createdAt: twoDaysAgo,
				siteSlug: 'test-site',
			};
			expect(isTabStale(tabInfo)).toBe(true);
		});
	});

	describe('initTabCoordinator', () => {
		it('creates tab info with correct site slug', () => {
			const tabInfo = initTabCoordinator('my-site');
			expect(tabInfo.siteSlug).toBe('my-site');
		});

		it('creates tab info with current timestamp', () => {
			const before = Date.now();
			const tabInfo = initTabCoordinator('my-site');
			const after = Date.now();
			expect(tabInfo.createdAt).toBeGreaterThanOrEqual(before);
			expect(tabInfo.createdAt).toBeLessThanOrEqual(after);
		});

		it('creates tab info with unique tab ID', () => {
			const tabInfo = initTabCoordinator('my-site');
			expect(tabInfo.tabId).toBeTruthy();
			expect(typeof tabInfo.tabId).toBe('string');
		});

		it('returns same tab info when called twice with same site', () => {
			const tabInfo1 = initTabCoordinator('my-site');
			const tabInfo2 = initTabCoordinator('my-site');
			expect(tabInfo1).toBe(tabInfo2);
		});

		it('creates new tab info when switching sites', () => {
			const tabInfo1 = initTabCoordinator('site-a');
			destroyTabCoordinator();
			const tabInfo2 = initTabCoordinator('site-b');
			expect(tabInfo1.tabId).not.toBe(tabInfo2.tabId);
			expect(tabInfo2.siteSlug).toBe('site-b');
		});
	});

	describe('getCurrentTabInfo', () => {
		it('returns null before initialization', () => {
			expect(getCurrentTabInfo()).toBeNull();
		});

		it('returns tab info after initialization', () => {
			initTabCoordinator('my-site');
			const tabInfo = getCurrentTabInfo();
			expect(tabInfo).not.toBeNull();
			expect(tabInfo!.siteSlug).toBe('my-site');
		});

		it('returns null after destroy', () => {
			initTabCoordinator('my-site');
			destroyTabCoordinator();
			expect(getCurrentTabInfo()).toBeNull();
		});
	});

	describe('setDependentMode', () => {
		it('sets isDependentMode on current tab info', () => {
			initTabCoordinator('my-site');
			setDependentMode(true);
			expect(getCurrentTabInfo()!.isDependentMode).toBe(true);
		});

		it('can toggle dependent mode off', () => {
			initTabCoordinator('my-site');
			setDependentMode(true);
			setDependentMode(false);
			expect(getCurrentTabInfo()!.isDependentMode).toBe(false);
		});

		it('does nothing if not initialized', () => {
			expect(() => setDependentMode(true)).not.toThrow();
		});
	});

	describe('checkForExistingTabs', () => {
		it('returns empty when no other tabs exist', async () => {
			initTabCoordinator('my-site');
			const result = await checkForExistingTabs('my-site');
			expect(result.existingTabs).toHaveLength(0);
			expect(result.hasFreshTab).toBe(false);
			expect(result.hasStaleTab).toBe(false);
		});

		it('returns empty when not initialized', async () => {
			const result = await checkForExistingTabs('my-site');
			expect(result.existingTabs).toHaveLength(0);
		});

		it('detects fresh tabs from other instances', async () => {
			initTabCoordinator('my-site');

			destroyTabCoordinator();
			initTabCoordinator('my-site');

			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				if (event.data.type === 'ping') {
					otherChannel.postMessage({
						type: 'pong',
						tabInfo: {
							tabId: 'other-tab',
							createdAt: Date.now(),
							siteSlug: 'my-site',
						},
					});
				}
			};

			const result = await checkForExistingTabs('my-site');
			expect(result.existingTabs).toHaveLength(1);
			expect(result.hasFreshTab).toBe(true);
			expect(result.hasStaleTab).toBe(false);

			otherChannel.close();
		});

		it('detects stale tabs', async () => {
			initTabCoordinator('my-site');

			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
			otherChannel.onmessage = (event: MessageEvent) => {
				if (event.data.type === 'ping') {
					otherChannel.postMessage({
						type: 'pong',
						tabInfo: {
							tabId: 'stale-tab',
							createdAt: twoDaysAgo,
							siteSlug: 'my-site',
						},
					});
				}
			};

			const result = await checkForExistingTabs('my-site');
			expect(result.existingTabs).toHaveLength(1);
			expect(result.hasFreshTab).toBe(false);
			expect(result.hasStaleTab).toBe(true);

			otherChannel.close();
		});

		it('ignores tabs for different sites', async () => {
			initTabCoordinator('my-site');

			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				if (event.data.type === 'ping') {
					otherChannel.postMessage({
						type: 'pong',
						tabInfo: {
							tabId: 'other-tab',
							createdAt: Date.now(),
							siteSlug: 'different-site',
						},
					});
				}
			};

			const result = await checkForExistingTabs('my-site');
			expect(result.existingTabs).toHaveLength(0);

			otherChannel.close();
		});

		it('ignores dependent mode tabs when checking for fresh tabs', async () => {
			initTabCoordinator('my-site');

			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				if (event.data.type === 'ping') {
					otherChannel.postMessage({
						type: 'pong',
						tabInfo: {
							tabId: 'dependent-tab',
							createdAt: Date.now(),
							siteSlug: 'my-site',
							isDependentMode: true,
						},
					});
				}
			};

			const result = await checkForExistingTabs('my-site');
			expect(result.existingTabs).toHaveLength(1);
			expect(result.hasFreshTab).toBe(false);

			otherChannel.close();
		});
	});

	describe('requestStaleTabsShutdown', () => {
		it('requests shutdown only for stale tabs', () => {
			initTabCoordinator('my-site');

			const shutdownRequests: string[] = [];
			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				if (event.data.type === 'shutdown-request') {
					shutdownRequests.push(event.data.targetTabId);
				}
			};

			const now = Date.now();
			const tabs: TabInfo[] = [
				{ tabId: 'fresh-tab', createdAt: now, siteSlug: 'my-site' },
				{
					tabId: 'stale-tab',
					createdAt: now - 25 * 60 * 60 * 1000,
					siteSlug: 'my-site',
				},
			];

			requestStaleTabsShutdown(tabs);

			expect(shutdownRequests).toHaveLength(1);
			expect(shutdownRequests[0]).toBe('stale-tab');

			otherChannel.close();
		});
	});

	describe('message handling', () => {
		it('responds to ping with pong for same site', () => {
			initTabCoordinator('my-site');
			const tabInfo = getCurrentTabInfo()!;

			const responses: unknown[] = [];
			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				responses.push(event.data);
			};

			otherChannel.postMessage({
				type: 'ping',
				tabId: 'other-tab',
				siteSlug: 'my-site',
			});

			expect(responses).toHaveLength(1);
			expect(responses[0]).toEqual({
				type: 'pong',
				tabInfo,
			});

			otherChannel.close();
		});

		it('does not respond to ping for different site', () => {
			initTabCoordinator('my-site');

			const responses: unknown[] = [];
			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				responses.push(event.data);
			};

			otherChannel.postMessage({
				type: 'ping',
				tabId: 'other-tab',
				siteSlug: 'different-site',
			});

			expect(responses).toHaveLength(0);

			otherChannel.close();
		});

		it('calls shutdown callback when shutdown requested', () => {
			const shutdownCallback = vi.fn();
			const tabInfo = initTabCoordinator('my-site', shutdownCallback);

			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.postMessage({
				type: 'shutdown-request',
				targetTabId: tabInfo.tabId,
				reason: 'stale',
			});

			expect(shutdownCallback).toHaveBeenCalledWith(
				'This tab has been open for over a day and a newer tab was opened.'
			);

			otherChannel.close();
		});

		it('calls takeover callback and sends acknowledgment', () => {
			const takeoverCallback = vi.fn();
			const tabInfo = initTabCoordinator(
				'my-site',
				undefined,
				takeoverCallback
			);

			const responses: unknown[] = [];
			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				responses.push(event.data);
			};

			otherChannel.postMessage({
				type: 'takeover-request',
				requestingTabId: 'new-tab',
				siteSlug: 'my-site',
			});

			expect(takeoverCallback).toHaveBeenCalled();
			expect(responses).toHaveLength(1);
			expect(responses[0]).toEqual({
				type: 'takeover-acknowledged',
				previousMainTabId: tabInfo.tabId,
				targetTabId: 'new-tab',
				siteSlug: 'my-site',
			});

			otherChannel.close();
		});

		it('does not respond to takeover request in dependent mode', () => {
			const takeoverCallback = vi.fn();
			initTabCoordinator('my-site', undefined, takeoverCallback);
			setDependentMode(true);

			const responses: unknown[] = [];
			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				responses.push(event.data);
			};

			otherChannel.postMessage({
				type: 'takeover-request',
				requestingTabId: 'new-tab',
				siteSlug: 'my-site',
			});

			expect(takeoverCallback).not.toHaveBeenCalled();
			expect(responses).toHaveLength(0);

			otherChannel.close();
		});

		it('calls site reset callback when site-reset received', () => {
			const siteResetCallback = vi.fn();
			initTabCoordinator(
				'my-site',
				undefined,
				undefined,
				undefined,
				siteResetCallback
			);

			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.postMessage({
				type: 'site-reset',
				siteSlug: 'my-site',
			});

			expect(siteResetCallback).toHaveBeenCalled();

			otherChannel.close();
		});
	});

	describe('requestTakeover', () => {
		it('returns false when not initialized', async () => {
			const result = await requestTakeover('my-site');
			expect(result).toBe(false);
		});

		it('resolves to true when acknowledged', async () => {
			const tabInfo = initTabCoordinator('my-site');

			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				if (event.data.type === 'takeover-request') {
					otherChannel.postMessage({
						type: 'takeover-acknowledged',
						previousMainTabId: 'old-main',
						targetTabId: tabInfo.tabId,
						siteSlug: 'my-site',
					});
				}
			};

			const result = await requestTakeover('my-site', 100);
			expect(result).toBe(true);

			otherChannel.close();
		});

		it('resolves to false on timeout', async () => {
			initTabCoordinator('my-site');

			const result = await requestTakeover('my-site', 50);
			expect(result).toBe(false);
		});
	});

	describe('requestRemoteBackup', () => {
		it('returns false when not initialized', async () => {
			const result = await requestRemoteBackup('my-site');
			expect(result).toBe(false);
		});

		it('resolves to true when backup succeeds', async () => {
			const tabInfo = initTabCoordinator('my-site');

			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				if (event.data.type === 'backup-request') {
					otherChannel.postMessage({
						type: 'backup-completed',
						targetTabId: tabInfo.tabId,
						siteSlug: 'my-site',
						success: true,
					});
				}
			};

			const result = await requestRemoteBackup('my-site', 100);
			expect(result).toBe(true);

			otherChannel.close();
		});

		it('resolves to false when backup fails', async () => {
			const tabInfo = initTabCoordinator('my-site');

			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				if (event.data.type === 'backup-request') {
					otherChannel.postMessage({
						type: 'backup-completed',
						targetTabId: tabInfo.tabId,
						siteSlug: 'my-site',
						success: false,
					});
				}
			};

			const result = await requestRemoteBackup('my-site', 100);
			expect(result).toBe(false);

			otherChannel.close();
		});

		it('handles backup request and calls callback', async () => {
			const backupCallback = vi.fn().mockResolvedValue(true);
			initTabCoordinator('my-site');
			setBackupRequestCallback(backupCallback);

			const responses: unknown[] = [];
			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				responses.push(event.data);
			};

			otherChannel.postMessage({
				type: 'backup-request',
				requestingTabId: 'requester-tab',
				siteSlug: 'my-site',
			});

			await vi.waitFor(() => {
				expect(backupCallback).toHaveBeenCalled();
			});

			await vi.waitFor(() => {
				expect(responses).toHaveLength(1);
			});

			expect(responses[0]).toEqual({
				type: 'backup-completed',
				targetTabId: 'requester-tab',
				siteSlug: 'my-site',
				success: true,
			});

			otherChannel.close();
		});
	});

	describe('broadcastSiteReset', () => {
		it('broadcasts site-reset message', () => {
			initTabCoordinator('my-site');

			const messages: unknown[] = [];
			const otherChannel = new MockBroadcastChannel(
				'playground-tab-coordinator'
			);
			otherChannel.onmessage = (event: MessageEvent) => {
				messages.push(event.data);
			};

			broadcastSiteReset('my-site');

			expect(messages).toHaveLength(1);
			expect(messages[0]).toEqual({
				type: 'site-reset',
				siteSlug: 'my-site',
			});

			otherChannel.close();
		});

		it('does nothing when not initialized', () => {
			expect(() => broadcastSiteReset('my-site')).not.toThrow();
		});
	});
});
