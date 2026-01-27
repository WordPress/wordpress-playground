/**
 * Tab Coordinator
 *
 * Manages coordination between multiple browser tabs accessing the same
 * WordPress Playground site. Handles:
 *
 * 1. Detection of existing tabs with active PHP workers
 * 2. Age-based decisions (tabs > 1 day old should yield to newer tabs)
 * 3. Graceful shutdown of stale tabs
 * 4. Signaling when a new tab can reuse an existing service worker
 */

export type TabInfo = {
	tabId: string;
	createdAt: number;
	siteSlug: string;
	isReady?: boolean;
	isDependentMode?: boolean;
};

type PingMessage = {
	type: 'ping';
	tabId: string;
	siteSlug: string;
};

type PongMessage = {
	type: 'pong';
	tabInfo: TabInfo;
};

type ShutdownRequestMessage = {
	type: 'shutdown-request';
	targetTabId: string;
	reason: 'stale' | 'superseded';
};

type TakeoverRequestMessage = {
	type: 'takeover-request';
	requestingTabId: string;
	siteSlug: string;
};

type TakeoverAcknowledgedMessage = {
	type: 'takeover-acknowledged';
	previousMainTabId: string;
	targetTabId: string;
	siteSlug: string;
};

type BackupRequestMessage = {
	type: 'backup-request';
	requestingTabId: string;
	siteSlug: string;
};

type BackupCompletedMessage = {
	type: 'backup-completed';
	targetTabId: string;
	siteSlug: string;
	success: boolean;
};

type SiteResetMessage = {
	type: 'site-reset';
	siteSlug: string;
};

type TabCoordinatorMessage =
	| PingMessage
	| PongMessage
	| ShutdownRequestMessage
	| TakeoverRequestMessage
	| TakeoverAcknowledgedMessage
	| BackupRequestMessage
	| BackupCompletedMessage
	| SiteResetMessage;

const CHANNEL_NAME = 'playground-tab-coordinator';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const PING_TIMEOUT_MS = 150;

let channel: BroadcastChannel | null = null;
let currentTabInfo: TabInfo | null = null;
let shutdownCallback: ((reason: string) => void) | null = null;
let takeoverCallback: (() => void) | null = null;
let backupRequestCallback: (() => Promise<boolean>) | null = null;
let siteResetCallback: (() => void) | null = null;
let beforeUnloadHandler: (() => void) | null = null;

/**
 * Initialize the tab coordinator for a specific site.
 *
 * @param siteSlug - The slug of the site being loaded
 * @param onShutdownRequested - Callback when this tab should shut down
 * @param onTakeoverRequested - Callback when another tab requests to become main
 * @param onBackupRequested - Callback when another tab requests a backup (main tab only)
 * @param onSiteReset - Callback when another tab has reset/deleted the site
 * @returns TabInfo for the current tab
 */
export function initTabCoordinator(
	siteSlug: string,
	onShutdownRequested?: (reason: string) => void,
	onTakeoverRequested?: () => void,
	onBackupRequested?: () => Promise<boolean>,
	onSiteReset?: () => void
): TabInfo {
	if (currentTabInfo && currentTabInfo.siteSlug === siteSlug) {
		return currentTabInfo;
	}

	// Clean up existing if switching sites
	if (channel) {
		channel.close();
	}
	if (beforeUnloadHandler && typeof window !== 'undefined') {
		window.removeEventListener('beforeunload', beforeUnloadHandler);
		beforeUnloadHandler = null;
	}

	currentTabInfo = {
		tabId: crypto.randomUUID(),
		createdAt: Date.now(),
		siteSlug,
	};

	shutdownCallback = onShutdownRequested || null;
	takeoverCallback = onTakeoverRequested || null;
	backupRequestCallback = onBackupRequested || null;
	siteResetCallback = onSiteReset || null;

	try {
		channel = new BroadcastChannel(CHANNEL_NAME);
		channel.onmessage = handleMessage;

		beforeUnloadHandler = () => {
			if (channel) {
				channel.postMessage({
					type: 'tab-closing',
					tabId: currentTabInfo?.tabId,
				});
				channel.close();
				channel = null;
			}
		};
		window.addEventListener('beforeunload', beforeUnloadHandler);
	} catch {
		// BroadcastChannel not supported
	}

	return currentTabInfo;
}

/**
 * Clean up the tab coordinator.
 */
export function destroyTabCoordinator(): void {
	if (channel) {
		channel.close();
		channel = null;
	}
	if (beforeUnloadHandler && typeof window !== 'undefined') {
		window.removeEventListener('beforeunload', beforeUnloadHandler);
		beforeUnloadHandler = null;
	}
	currentTabInfo = null;
	shutdownCallback = null;
	takeoverCallback = null;
	backupRequestCallback = null;
	siteResetCallback = null;
}

/**
 * Check for existing tabs running the same site.
 *
 * @param siteSlug - The site to check for
 * @returns Promise resolving to info about existing tabs (if any)
 */
export async function checkForExistingTabs(siteSlug: string): Promise<{
	existingTabs: TabInfo[];
	hasFreshTab: boolean;
	hasStaleTab: boolean;
}> {
	if (!channel || !currentTabInfo) {
		return { existingTabs: [], hasFreshTab: false, hasStaleTab: false };
	}

	const existingTabs: TabInfo[] = [];
	const now = Date.now();

	const pongHandler = (event: MessageEvent<TabCoordinatorMessage>) => {
		const message = event.data;
		if (
			message.type === 'pong' &&
			message.tabInfo.siteSlug === siteSlug &&
			message.tabInfo.tabId !== currentTabInfo?.tabId
		) {
			existingTabs.push(message.tabInfo);
		}
	};

	channel.addEventListener('message', pongHandler);

	const pingMessage: PingMessage = {
		type: 'ping',
		tabId: currentTabInfo.tabId,
		siteSlug,
	};
	channel.postMessage(pingMessage);

	await new Promise((resolve) => setTimeout(resolve, PING_TIMEOUT_MS));

	channel.removeEventListener('message', pongHandler);

	const hasFreshTab = existingTabs.some(
		(tab) => now - tab.createdAt < ONE_DAY_MS && !tab.isDependentMode
	);
	const hasStaleTab = existingTabs.some(
		(tab) => now - tab.createdAt >= ONE_DAY_MS && !tab.isDependentMode
	);

	return { existingTabs, hasFreshTab, hasStaleTab };
}

/**
 * Request a specific tab to shut down.
 *
 * @param targetTabId - The tab ID to shut down
 * @param reason - Why the tab should shut down
 */
function requestTabShutdown(
	targetTabId: string,
	reason: 'stale' | 'superseded'
): void {
	if (!channel) {
		return;
	}

	const message: ShutdownRequestMessage = {
		type: 'shutdown-request',
		targetTabId,
		reason,
	};
	channel.postMessage(message);
}

/**
 * Request all stale tabs for a site to shut down.
 *
 * @param tabs - List of tabs to check
 */
export function requestStaleTabsShutdown(tabs: TabInfo[]): void {
	const now = Date.now();
	for (const tab of tabs) {
		if (now - tab.createdAt >= ONE_DAY_MS) {
			requestTabShutdown(tab.tabId, 'stale');
		}
	}
}

/**
 * Get the current tab's info.
 */
export function getCurrentTabInfo(): TabInfo | null {
	return currentTabInfo;
}

/**
 * Check if a tab is considered stale (older than 1 day).
 */
export function isTabStale(tabInfo: TabInfo): boolean {
	return Date.now() - tabInfo.createdAt >= ONE_DAY_MS;
}

/**
 * Mark the current tab as being in dependent mode.
 * This means it's using another tab's worker and shouldn't claim main status.
 */
export function setDependentMode(isDependentMode: boolean): void {
	if (currentTabInfo) {
		currentTabInfo.isDependentMode = isDependentMode;
	}
}

/**
 * Set the callback for handling backup requests from other tabs.
 * This is separate from initTabCoordinator because the backup function
 * may not be available at initialization time.
 */
export function setBackupRequestCallback(
	callback: (() => Promise<boolean>) | null
): void {
	backupRequestCallback = callback;
}

/**
 * Request to take over as the main tab from another tab.
 * Sends a takeover-request and waits for acknowledgment.
 *
 * @param siteSlug - The site to take over
 * @param timeoutMs - How long to wait for acknowledgment (default 2000ms)
 * @returns Promise that resolves to true if takeover was acknowledged, false otherwise
 */
export async function requestTakeover(
	siteSlug: string,
	timeoutMs = 2000
): Promise<boolean> {
	if (!channel || !currentTabInfo) {
		return false;
	}

	const tabId = currentTabInfo.tabId;
	const currentChannel = channel;

	return new Promise((resolve) => {
		let resolved = false;

		const ackHandler = (event: MessageEvent<TabCoordinatorMessage>) => {
			const message = event.data;
			if (
				message.type === 'takeover-acknowledged' &&
				message.siteSlug === siteSlug &&
				message.targetTabId === tabId
			) {
				resolved = true;
				currentChannel.removeEventListener('message', ackHandler);
				resolve(true);
			}
		};

		currentChannel.addEventListener('message', ackHandler);

		const requestMessage: TakeoverRequestMessage = {
			type: 'takeover-request',
			requestingTabId: tabId,
			siteSlug,
		};
		currentChannel.postMessage(requestMessage);

		setTimeout(() => {
			if (!resolved) {
				currentChannel.removeEventListener('message', ackHandler);
				resolve(false);
			}
		}, timeoutMs);
	});
}

/**
 * Request a backup from the main tab (for dependent tabs).
 * Sends a backup-request and waits for completion.
 *
 * @param siteSlug - The site to backup
 * @param timeoutMs - How long to wait for completion (default 30000ms)
 * @returns Promise that resolves to true if backup succeeded, false otherwise
 */
export async function requestRemoteBackup(
	siteSlug: string,
	timeoutMs = 30000
): Promise<boolean> {
	if (!channel || !currentTabInfo) {
		return false;
	}

	const tabId = currentTabInfo.tabId;
	const currentChannel = channel;

	return new Promise((resolve) => {
		let resolved = false;

		const completedHandler = (
			event: MessageEvent<TabCoordinatorMessage>
		) => {
			const message = event.data;
			if (
				message.type === 'backup-completed' &&
				message.siteSlug === siteSlug &&
				message.targetTabId === tabId
			) {
				resolved = true;
				currentChannel.removeEventListener('message', completedHandler);
				resolve(message.success);
			}
		};

		currentChannel.addEventListener('message', completedHandler);

		const requestMessage: BackupRequestMessage = {
			type: 'backup-request',
			requestingTabId: tabId,
			siteSlug,
		};
		currentChannel.postMessage(requestMessage);

		setTimeout(() => {
			if (!resolved) {
				currentChannel.removeEventListener('message', completedHandler);
				resolve(false);
			}
		}, timeoutMs);
	});
}

/**
 * Broadcast that a site is being reset/deleted.
 * This notifies other tabs to reload since the site data is being deleted.
 *
 * @param siteSlug - The site being reset
 */
export function broadcastSiteReset(siteSlug: string): void {
	if (!channel) {
		return;
	}

	const message: SiteResetMessage = {
		type: 'site-reset',
		siteSlug,
	};
	channel.postMessage(message);
}

function handleMessage(event: MessageEvent<TabCoordinatorMessage>): void {
	if (!currentTabInfo || !channel) {
		return;
	}

	const message = event.data;

	switch (message.type) {
		case 'ping':
			if (message.siteSlug === currentTabInfo.siteSlug) {
				const pongMessage: PongMessage = {
					type: 'pong',
					tabInfo: currentTabInfo,
				};
				channel.postMessage(pongMessage);
			}
			break;

		case 'shutdown-request':
			if (message.targetTabId === currentTabInfo.tabId) {
				const reason =
					message.reason === 'stale'
						? 'This tab has been open for over a day and a newer tab was opened.'
						: 'A newer tab has taken over this session.';
				shutdownCallback?.(reason);
			}
			break;

		case 'takeover-request':
			if (
				message.siteSlug === currentTabInfo.siteSlug &&
				!currentTabInfo.isDependentMode
			) {
				takeoverCallback?.();
				const ackMessage: TakeoverAcknowledgedMessage = {
					type: 'takeover-acknowledged',
					previousMainTabId: currentTabInfo.tabId,
					targetTabId: message.requestingTabId,
					siteSlug: message.siteSlug,
				};
				channel.postMessage(ackMessage);
			}
			break;

		case 'takeover-acknowledged':
			break;

		case 'backup-request':
			if (
				message.siteSlug === currentTabInfo.siteSlug &&
				!currentTabInfo.isDependentMode &&
				backupRequestCallback
			) {
				backupRequestCallback().then((success) => {
					const completedMessage: BackupCompletedMessage = {
						type: 'backup-completed',
						targetTabId: message.requestingTabId,
						siteSlug: message.siteSlug,
						success,
					};
					channel?.postMessage(completedMessage);
				});
			}
			break;

		case 'backup-completed':
			break;

		case 'site-reset':
			if (message.siteSlug === currentTabInfo.siteSlug) {
				siteResetCallback?.();
			}
			break;
	}
}
