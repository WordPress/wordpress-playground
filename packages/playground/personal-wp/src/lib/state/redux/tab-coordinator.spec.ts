import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	initTabCoordinator,
	destroyTabCoordinator,
	getCurrentTabInfo,
	markMainTabReady,
	refreshMainTabStatus,
	requestRemoteBackup,
	requestRemoteBlueprintInstall,
	requestMainTabFocus,
	broadcastSiteReset,
	setBackupRequestCallback,
	setInstallBlueprintRequestCallback,
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
				instance.onmessage?.(event);
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
		if (!handlers) return;
		const index = handlers.indexOf(handler);
		if (index !== -1) {
			handlers.splice(index, 1);
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

class MockLockManager {
	private held = new Set<string>();

	async request<T>(
		name: string,
		options: { ifAvailable?: boolean },
		callback: (lock: unknown | null) => T | Promise<T>
	): Promise<T> {
		if (options.ifAvailable && this.held.has(name)) {
			return await callback(null);
		}

		this.held.add(name);
		try {
			return await callback({ name });
		} finally {
			this.held.delete(name);
		}
	}

	async query(): Promise<{ held: Array<{ name: string }> }> {
		return {
			held: [...this.held].map((name) => ({ name })),
		};
	}

	hold(name: string): () => void {
		this.held.add(name);
		return () => {
			this.held.delete(name);
		};
	}

	isHeld(name: string): boolean {
		return this.held.has(name);
	}
}

const MAIN_LOCK_NAME = 'personal-wp:main';
const READY_LOCK_NAME = 'personal-wp:ready';
const sessionStorageMap = new Map<string, string>();
let uuidCounter = 0;
let locks: MockLockManager;
let focusWindow: ReturnType<typeof vi.fn>;

function setNavigationType(type: string) {
	vi.stubGlobal('performance', {
		getEntriesByType: () => [{ type }],
	});
}

async function flushLockReleases() {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

describe('tab-coordinator', () => {
	beforeEach(() => {
		sessionStorageMap.clear();
		MockBroadcastChannel.reset();
		uuidCounter = 0;
		locks = new MockLockManager();

		vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
		vi.stubGlobal('crypto', {
			randomUUID: () => `tab-${++uuidCounter}`,
		});
		vi.stubGlobal('navigator', {
			locks,
		});
		vi.stubGlobal('sessionStorage', {
			getItem: (key: string) => sessionStorageMap.get(key) || null,
			setItem: (key: string, value: string) => {
				sessionStorageMap.set(key, value);
			},
			removeItem: (key: string) => {
				sessionStorageMap.delete(key);
			},
		});
		focusWindow = vi.fn();
		vi.stubGlobal('window', {
			focus: focusWindow,
		});
		setNavigationType('navigate');
		destroyTabCoordinator();
	});

	afterEach(async () => {
		destroyTabCoordinator();
		await flushLockReleases();
		MockBroadcastChannel.reset();
		vi.useRealTimers();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('claims the main lock and starts in booting status', async () => {
		const tabInfo = await initTabCoordinator('my-site');

		expect(tabInfo.isDependentMode).toBe(false);
		expect(tabInfo.mainTabStatus).toBe('booting');
		expect(locks.isHeld(MAIN_LOCK_NAME)).toBe(true);
		expect(locks.isHeld(READY_LOCK_NAME)).toBe(false);
	});

	it('holds the ready lock after the main runtime is ready', async () => {
		const tabInfo = await initTabCoordinator('my-site');

		await expect(markMainTabReady()).resolves.toBe(true);

		expect(tabInfo.mainTabStatus).toBe('connected');
		expect(locks.isHeld(MAIN_LOCK_NAME)).toBe(true);
		expect(locks.isHeld(READY_LOCK_NAME)).toBe(true);
	});

	it('boots as dependent when a main tab already exists', async () => {
		locks.hold(MAIN_LOCK_NAME);

		const dependentTab = await initTabCoordinator('my-site');

		expect(dependentTab.isDependentMode).toBe(true);
		expect(dependentTab.mainTabStatus).toBe('booting');
	});

	it('reports connected when main and ready locks are held', async () => {
		locks.hold(MAIN_LOCK_NAME);
		locks.hold(READY_LOCK_NAME);

		const dependentTab = await initTabCoordinator('my-site');

		expect(dependentTab.isDependentMode).toBe(true);
		expect(dependentTab.mainTabStatus).toBe('connected');
	});

	it('reports missing when Web Locks are unavailable', async () => {
		vi.stubGlobal('navigator', {});

		const tabInfo = await initTabCoordinator('my-site');

		expect(tabInfo.isDependentMode).toBe(true);
		expect(tabInfo.mainTabStatus).toBe('missing');
	});

	it('does not auto-promote a dependent tab when the main lock disappears', async () => {
		const releaseMain = locks.hold(MAIN_LOCK_NAME);
		const statuses: string[] = [];
		const dependentTab = await initTabCoordinator('my-site', {
			onMainTabStatusChange: (status) => statuses.push(status),
		});

		releaseMain();
		await refreshMainTabStatus();

		expect(dependentTab.isDependentMode).toBe(true);
		expect(getCurrentTabInfo()?.isDependentMode).toBe(true);
		expect(locks.isHeld(MAIN_LOCK_NAME)).toBe(false);
		expect(statuses).toContain('missing');
	});

	it('keeps the same tab id across a reload', async () => {
		const mainTab = await initTabCoordinator('my-site');
		destroyTabCoordinator();
		await flushLockReleases();

		setNavigationType('reload');
		const reloadedTab = await initTabCoordinator('my-site');

		expect(reloadedTab.tabId).toBe(mainTab.tabId);
		expect(reloadedTab.isDependentMode).toBe(false);
	});

	it('creates a new tab id for non-reload navigation', async () => {
		const mainTab = await initTabCoordinator('my-site');
		destroyTabCoordinator();
		await flushLockReleases();

		const newTab = await initTabCoordinator('other-site');

		expect(newTab.tabId).not.toBe(mainTab.tabId);
	});

	it('handles backup requests in the main tab', async () => {
		const backupCallback = vi.fn().mockResolvedValue(true);
		await initTabCoordinator('my-site');
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
			requestingTabId: 'dependent-tab',
			siteSlug: 'my-site',
		});

		await vi.waitFor(() => expect(backupCallback).toHaveBeenCalled());
		await vi.waitFor(() => expect(responses).toHaveLength(1));
		expect(responses[0]).toEqual({
			type: 'backup-completed',
			targetTabId: 'dependent-tab',
			siteSlug: 'my-site',
			success: true,
		});
	});

	it('requestRemoteBackup resolves when the main tab responds', async () => {
		const tabInfo = await initTabCoordinator('my-site');
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

		await expect(requestRemoteBackup('my-site', 100)).resolves.toBe(true);
	});

	it('handles install-blueprint requests in the main tab', async () => {
		const installCallback = vi.fn().mockResolvedValue({
			status: 'success',
		});
		await initTabCoordinator('my-site');
		setInstallBlueprintRequestCallback(installCallback);

		const responses: unknown[] = [];
		const otherChannel = new MockBroadcastChannel(
			'playground-tab-coordinator'
		);
		otherChannel.onmessage = (event: MessageEvent) => {
			responses.push(event.data);
		};

		otherChannel.postMessage({
			type: 'install-blueprint-request',
			requestId: 'request-1',
			requestingTabId: 'dependent-tab',
			siteSlug: 'my-site',
			blueprintUrl: 'https://example.com/blueprint.json',
		});

		await vi.waitFor(() =>
			expect(installCallback).toHaveBeenCalledWith(
				'https://example.com/blueprint.json'
			)
		);
		await vi.waitFor(() => expect(responses).toHaveLength(1));
		expect(responses[0]).toEqual({
			type: 'install-blueprint-result',
			requestId: 'request-1',
			targetTabId: 'dependent-tab',
			siteSlug: 'my-site',
			result: {
				status: 'success',
			},
		});
	});

	it('passes the trusted install request source to the main tab', async () => {
		const installCallback = vi.fn().mockResolvedValue({
			status: 'success',
		});
		await initTabCoordinator('my-site');
		setInstallBlueprintRequestCallback(installCallback);

		const otherChannel = new MockBroadcastChannel(
			'playground-tab-coordinator'
		);

		otherChannel.postMessage({
			type: 'install-blueprint-request',
			requestId: 'request-1',
			requestingTabId: 'dependent-tab',
			siteSlug: 'my-site',
			blueprintUrl: 'https://example.com/blueprint.json',
			usageStatsRequestSource: 'my-apps',
		});

		await vi.waitFor(() =>
			expect(installCallback).toHaveBeenCalledWith(
				'https://example.com/blueprint.json',
				{
					usageStatsRequestSource: 'my-apps',
				}
			)
		);
	});

	it('requestRemoteBlueprintInstall resolves when the main tab responds', async () => {
		const tabInfo = await initTabCoordinator('my-site');
		const otherChannel = new MockBroadcastChannel(
			'playground-tab-coordinator'
		);
		otherChannel.onmessage = (event: MessageEvent) => {
			if (event.data.type === 'install-blueprint-request') {
				otherChannel.postMessage({
					type: 'install-blueprint-result',
					requestId: event.data.requestId,
					targetTabId: tabInfo.tabId,
					siteSlug: 'my-site',
					result: {
						status: 'success',
					},
				});
			}
		};

		await expect(
			requestRemoteBlueprintInstall(
				'my-site',
				'https://example.com/blueprint.json',
				100
			)
		).resolves.toEqual({
			status: 'success',
		});
	});

	it('includes the trusted install source in remote install requests', async () => {
		const tabInfo = await initTabCoordinator('my-site');
		const requests: unknown[] = [];
		const otherChannel = new MockBroadcastChannel(
			'playground-tab-coordinator'
		);
		otherChannel.onmessage = (event: MessageEvent) => {
			if (event.data.type === 'install-blueprint-request') {
				requests.push(event.data);
				otherChannel.postMessage({
					type: 'install-blueprint-result',
					requestId: event.data.requestId,
					targetTabId: tabInfo.tabId,
					siteSlug: 'my-site',
					result: {
						status: 'success',
					},
				});
			}
		};

		await expect(
			requestRemoteBlueprintInstall(
				'my-site',
				'https://example.com/blueprint.json',
				{
					timeoutMs: 100,
					usageStatsRequestSource: 'my-apps',
				}
			)
		).resolves.toEqual({
			status: 'success',
		});
		expect(requests[0]).toMatchObject({
			type: 'install-blueprint-request',
			usageStatsRequestSource: 'my-apps',
		});
	});

	it('returns recovery guidance when remote blueprint install times out', async () => {
		vi.useFakeTimers();
		await initTabCoordinator('my-site');

		const installResult = requestRemoteBlueprintInstall(
			'my-site',
			'https://example.com/blueprint.json',
			5000
		);
		await vi.advanceTimersByTimeAsync(5000);

		await expect(installResult).resolves.toEqual({
			status: 'error',
			error: expect.stringContaining(
				'Timed out after 5 seconds waiting for the main tab'
			),
		});
		await expect(installResult).resolves.toEqual({
			status: 'error',
			error: expect.stringContaining(
				'reload this tab or open a new tab to reconnect'
			),
		});
	});

	it('focuses and highlights the main tab on request', async () => {
		vi.useFakeTimers();
		const documentStub = { title: 'My WordPress' };
		vi.stubGlobal('document', documentStub);
		await initTabCoordinator('my-site');

		const responses: unknown[] = [];
		const otherChannel = new MockBroadcastChannel(
			'playground-tab-coordinator'
		);
		otherChannel.onmessage = (event: MessageEvent) => {
			responses.push(event.data);
		};

		otherChannel.postMessage({
			type: 'main-tab-focus-request',
			requestingTabId: 'dependent-tab',
			siteSlug: 'my-site',
		});

		expect(focusWindow).toHaveBeenCalled();
		expect(responses).toEqual([
			{
				type: 'main-tab-focus-acknowledged',
				targetTabId: 'dependent-tab',
				siteSlug: 'my-site',
			},
		]);

		vi.advanceTimersByTime(700);
		expect(documentStub.title).toBe('* My WordPress');
		vi.advanceTimersByTime(8000);
		expect(documentStub.title).toBe('My WordPress');
	});

	it('does not clobber title changes while flashing the main tab', async () => {
		vi.useFakeTimers();
		const documentStub = { title: 'My WordPress' };
		vi.stubGlobal('document', documentStub);
		await initTabCoordinator('my-site');

		const otherChannel = new MockBroadcastChannel(
			'playground-tab-coordinator'
		);
		otherChannel.postMessage({
			type: 'main-tab-focus-request',
			requestingTabId: 'dependent-tab',
			siteSlug: 'my-site',
		});

		vi.advanceTimersByTime(700);
		expect(documentStub.title).toBe('* My WordPress');

		documentStub.title = 'Updated WordPress';
		vi.advanceTimersByTime(8000);

		expect(documentStub.title).toBe('Updated WordPress');
	});

	it('requestMainTabFocus resolves when acknowledged', async () => {
		const tabInfo = await initTabCoordinator('my-site');
		const otherChannel = new MockBroadcastChannel(
			'playground-tab-coordinator'
		);
		otherChannel.onmessage = (event: MessageEvent) => {
			if (event.data.type === 'main-tab-focus-request') {
				otherChannel.postMessage({
					type: 'main-tab-focus-acknowledged',
					targetTabId: tabInfo.tabId,
					siteSlug: 'my-site',
				});
			}
		};

		await expect(requestMainTabFocus('my-site', 100)).resolves.toBe(true);
	});

	it('broadcasts site reset and releases held locks', async () => {
		const resetCallback = vi.fn();
		await initTabCoordinator('my-site', { onSiteReset: resetCallback });
		await markMainTabReady();
		const otherChannel = new MockBroadcastChannel(
			'playground-tab-coordinator'
		);

		broadcastSiteReset('my-site');
		await flushLockReleases();
		otherChannel.postMessage({
			type: 'site-reset',
			siteSlug: 'my-site',
		});

		expect(locks.isHeld(MAIN_LOCK_NAME)).toBe(false);
		expect(locks.isHeld(READY_LOCK_NAME)).toBe(false);
		expect(resetCallback).toHaveBeenCalled();
	});
});
