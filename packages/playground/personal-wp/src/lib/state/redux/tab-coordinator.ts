/**
 * Coordinates the single Personal WP runtime across browser tabs.
 *
 * Ownership is browser-managed via Web Locks:
 * - personal-wp:main is held while a tab owns the runtime.
 * - personal-wp:ready is held only after the runtime can serve requests.
 *
 * Dependent tabs never acquire these locks while already running. They only
 * observe lock state and preserve the current WordPress iframe when the main
 * runtime disappears.
 */

export type MainTabStatus = 'connected' | 'booting' | 'missing';

export type TabInfo = {
	tabId: string;
	createdAt: number;
	siteSlug: string;
	isDependentMode?: boolean;
	mainTabStatus?: MainTabStatus;
};

export type InstallBlueprintCommandResult = {
	status: 'success' | 'error';
	error?: string;
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

type MainTabFocusRequestMessage = {
	type: 'main-tab-focus-request';
	requestingTabId: string;
	siteSlug: string;
};

type MainTabFocusAcknowledgedMessage = {
	type: 'main-tab-focus-acknowledged';
	targetTabId: string;
	siteSlug: string;
};

type MainTabStatusMessage = {
	type: 'main-tab-status';
	tabId: string;
	siteSlug: string;
	status: MainTabStatus;
};

type InstallBlueprintRequestMessage = {
	type: 'install-blueprint-request';
	requestId: string;
	requestingTabId: string;
	siteSlug: string;
	blueprintUrl: string;
};

type InstallBlueprintResultMessage = {
	type: 'install-blueprint-result';
	requestId: string;
	targetTabId: string;
	siteSlug: string;
	result: InstallBlueprintCommandResult;
};

type SiteResetMessage = {
	type: 'site-reset';
	siteSlug: string;
};

type TabCoordinatorMessage =
	| BackupRequestMessage
	| BackupCompletedMessage
	| MainTabFocusRequestMessage
	| MainTabFocusAcknowledgedMessage
	| MainTabStatusMessage
	| InstallBlueprintRequestMessage
	| InstallBlueprintResultMessage
	| SiteResetMessage;

type TabCoordinatorOptions = {
	onMainTabStatusChange?: (status: MainTabStatus) => void;
	onSiteReset?: () => void;
};

type LockManagerLike = {
	request<T>(
		name: string,
		options: {
			mode?: 'exclusive';
			ifAvailable?: boolean;
		},
		callback: (lock: unknown | null) => T | Promise<T>
	): Promise<T>;
	query?: () => Promise<{
		held?: Array<{ name?: string }>;
		pending?: Array<{ name?: string }>;
	}>;
};

const CHANNEL_NAME = 'playground-tab-coordinator';
const TAB_ID_STORAGE_KEY = 'playground-tab-coordinator-tab-id';
const MAIN_LOCK_NAME = 'personal-wp:main';
const READY_LOCK_NAME = 'personal-wp:ready';
const MAIN_TAB_STATUS_POLL_INTERVAL_MS = 2000;
const INSTALL_BLUEPRINT_TIMEOUT_MS = 300000;

let channel: BroadcastChannel | null = null;
let currentTabInfo: TabInfo | null = null;
let currentOptions: TabCoordinatorOptions = {};
let backupRequestCallback: (() => Promise<boolean>) | null = null;
let installBlueprintRequestCallback:
	| ((blueprintUrl: string) => Promise<InstallBlueprintCommandResult>)
	| null = null;
let mainLockRelease: (() => void) | null = null;
let readyLockRelease: (() => void) | null = null;
let mainLockRequest: Promise<unknown> | null = null;
let readyLockRequest: Promise<unknown> | null = null;
let pendingLockRelease: Promise<void> = Promise.resolve();
let mainTabStatusPollInterval: ReturnType<typeof setInterval> | null = null;
let visibilityChangeHandler: (() => void) | null = null;
let titleFlashInterval: ReturnType<typeof setInterval> | null = null;
let titleFlashTimeout: ReturnType<typeof setTimeout> | null = null;
let titleFlashOriginalTitle: string | null = null;

export async function initTabCoordinator(
	siteSlug: string,
	options: TabCoordinatorOptions = {}
): Promise<TabInfo> {
	if (currentTabInfo?.siteSlug === siteSlug) {
		currentOptions = options;
		return currentTabInfo;
	}

	destroyTabCoordinator();
	await pendingLockRelease;

	currentOptions = options;
	currentTabInfo = {
		tabId: getBrowserTabId(),
		createdAt: Date.now(),
		siteSlug,
	};

	setupBroadcastChannel();

	if (await acquireMainLock()) {
		currentTabInfo.isDependentMode = false;
		setCurrentMainTabStatus('booting');
		broadcastMainTabStatus('booting');
		return currentTabInfo;
	}

	currentTabInfo.isDependentMode = true;
	setCurrentMainTabStatus(await queryMainTabStatus());
	startMainTabStatusWatcher();
	return currentTabInfo;
}

export function destroyTabCoordinator(): void {
	const wasMainTab = isCurrentMainTab();
	stopMainTabStatusWatcher();
	releaseHeldLocks();
	if (wasMainTab) {
		broadcastMainTabStatus('missing');
	}
	if (channel) {
		channel.close();
		channel = null;
	}
	currentTabInfo = null;
	currentOptions = {};
	backupRequestCallback = null;
	installBlueprintRequestCallback = null;
	clearTitleFlash();
}

export function getCurrentTabInfo(): TabInfo | null {
	return currentTabInfo;
}

export async function markMainTabReady(): Promise<boolean> {
	if (!isCurrentMainTab()) {
		return false;
	}
	if (readyLockRelease) {
		setCurrentMainTabStatus('connected');
		broadcastMainTabStatus('connected');
		return true;
	}
	const acquiredReadyLock = await acquireReadyLock();
	if (acquiredReadyLock) {
		setCurrentMainTabStatus('connected');
		broadcastMainTabStatus('connected');
	}
	return acquiredReadyLock;
}

export async function refreshMainTabStatus(): Promise<MainTabStatus> {
	const status = await queryMainTabStatus();
	setCurrentMainTabStatus(status);
	return status;
}

export function setBackupRequestCallback(
	callback: (() => Promise<boolean>) | null
): void {
	backupRequestCallback = callback;
}

export function setInstallBlueprintRequestCallback(
	callback:
		| ((blueprintUrl: string) => Promise<InstallBlueprintCommandResult>)
		| null
): void {
	installBlueprintRequestCallback = callback;
}

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
				cleanup();
				resolve(message.success);
			}
		};

		function cleanup() {
			currentChannel.removeEventListener('message', completedHandler);
			clearTimeout(timeoutId);
		}

		currentChannel.addEventListener('message', completedHandler);
		const timeoutId = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				cleanup();
				resolve(false);
			}
		}, timeoutMs);
		currentChannel.postMessage({
			type: 'backup-request',
			requestingTabId: tabId,
			siteSlug,
		} satisfies BackupRequestMessage);
	});
}

export async function requestRemoteBlueprintInstall(
	siteSlug: string,
	blueprintUrl: string,
	timeoutMs = INSTALL_BLUEPRINT_TIMEOUT_MS
): Promise<InstallBlueprintCommandResult> {
	if (!channel || !currentTabInfo) {
		return {
			status: 'error',
			error: getMainTabUnavailableMessage('missing'),
		};
	}

	const tabId = currentTabInfo.tabId;
	const requestId = createRequestId();
	const currentChannel = channel;

	return new Promise((resolve) => {
		let resolved = false;

		const resultHandler = (event: MessageEvent<TabCoordinatorMessage>) => {
			const message = event.data;
			if (
				message.type === 'install-blueprint-result' &&
				message.siteSlug === siteSlug &&
				message.targetTabId === tabId &&
				message.requestId === requestId
			) {
				resolved = true;
				cleanup();
				resolve(message.result);
			}
		};

		function cleanup() {
			currentChannel.removeEventListener('message', resultHandler);
			clearTimeout(timeoutId);
		}

		currentChannel.addEventListener('message', resultHandler);
		const timeoutId = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				cleanup();
				resolve({
					status: 'error',
					error: getInstallBlueprintTimeoutMessage(timeoutMs),
				});
			}
		}, timeoutMs);
		currentChannel.postMessage({
			type: 'install-blueprint-request',
			requestId,
			requestingTabId: tabId,
			siteSlug,
			blueprintUrl,
		} satisfies InstallBlueprintRequestMessage);
	});
}

export async function requestMainTabFocus(
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
				message.type === 'main-tab-focus-acknowledged' &&
				message.siteSlug === siteSlug &&
				message.targetTabId === tabId
			) {
				resolved = true;
				cleanup();
				resolve(true);
			}
		};

		function cleanup() {
			currentChannel.removeEventListener('message', ackHandler);
			clearTimeout(timeoutId);
		}

		currentChannel.addEventListener('message', ackHandler);
		const timeoutId = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				cleanup();
				resolve(false);
			}
		}, timeoutMs);
		currentChannel.postMessage({
			type: 'main-tab-focus-request',
			requestingTabId: tabId,
			siteSlug,
		} satisfies MainTabFocusRequestMessage);
	});
}

export function broadcastSiteReset(siteSlug: string): void {
	if (currentTabInfo?.siteSlug === siteSlug) {
		releaseHeldLocks();
	}
	channel?.postMessage({
		type: 'site-reset',
		siteSlug,
	} satisfies SiteResetMessage);
}

export function getMainTabUnavailableMessage(status: MainTabStatus): string {
	if (status === 'booting') {
		return 'The active WordPress tab is still reconnecting. Try again in a moment.';
	}
	return 'The active WordPress tab was closed or disconnected. Reload this tab or open a new tab to reconnect.';
}

function getInstallBlueprintTimeoutMessage(timeoutMs: number): string {
	const timeoutSeconds = Math.round(timeoutMs / 1000);
	return (
		`Timed out after ${timeoutSeconds} seconds waiting for the main tab ` +
		'to install the app. Focus the active WordPress tab and try again. ' +
		'If it was closed, reload this tab or open a new tab to reconnect.'
	);
}

function setupBroadcastChannel(): void {
	try {
		channel = new BroadcastChannel(CHANNEL_NAME);
		channel.onmessage = handleMessage;
	} catch {
		channel = null;
	}
}

function handleMessage(event: MessageEvent<TabCoordinatorMessage>): void {
	if (!currentTabInfo || !channel) {
		return;
	}

	const message = event.data;

	switch (message.type) {
		case 'backup-request':
			if (
				message.siteSlug === currentTabInfo.siteSlug &&
				isCurrentMainTab() &&
				backupRequestCallback
			) {
				backupRequestCallback().then((success) => {
					channel?.postMessage({
						type: 'backup-completed',
						targetTabId: message.requestingTabId,
						siteSlug: message.siteSlug,
						success,
					} satisfies BackupCompletedMessage);
				});
			}
			break;

		case 'main-tab-focus-request':
			if (
				message.siteSlug === currentTabInfo.siteSlug &&
				isCurrentMainTab()
			) {
				focusAndHighlightCurrentTab();
				channel.postMessage({
					type: 'main-tab-focus-acknowledged',
					targetTabId: message.requestingTabId,
					siteSlug: message.siteSlug,
				} satisfies MainTabFocusAcknowledgedMessage);
			}
			break;

		case 'main-tab-status':
			if (
				message.siteSlug === currentTabInfo.siteSlug &&
				message.tabId !== currentTabInfo.tabId &&
				currentTabInfo.isDependentMode
			) {
				if (message.status === 'missing') {
					void refreshMainTabStatus();
				} else {
					setCurrentMainTabStatus(message.status);
				}
			}
			break;

		case 'install-blueprint-request':
			if (
				message.siteSlug === currentTabInfo.siteSlug &&
				isCurrentMainTab() &&
				installBlueprintRequestCallback
			) {
				installBlueprintRequestCallback(message.blueprintUrl)
					.catch(
						(error): InstallBlueprintCommandResult => ({
							status: 'error',
							error: getErrorMessage(error),
						})
					)
					.then((result) => {
						channel?.postMessage({
							type: 'install-blueprint-result',
							requestId: message.requestId,
							targetTabId: message.requestingTabId,
							siteSlug: message.siteSlug,
							result,
						} satisfies InstallBlueprintResultMessage);
					});
			}
			break;

		case 'site-reset':
			if (message.siteSlug === currentTabInfo.siteSlug) {
				currentOptions.onSiteReset?.();
			}
			break;

		case 'backup-completed':
		case 'main-tab-focus-acknowledged':
		case 'install-blueprint-result':
			break;
	}
}

function broadcastMainTabStatus(status: MainTabStatus): void {
	if (!channel || !currentTabInfo) {
		return;
	}
	channel.postMessage({
		type: 'main-tab-status',
		tabId: currentTabInfo.tabId,
		siteSlug: currentTabInfo.siteSlug,
		status,
	} satisfies MainTabStatusMessage);
}

async function acquireMainLock(): Promise<boolean> {
	if (mainLockRelease) {
		return true;
	}
	return await acquireHeldLock(MAIN_LOCK_NAME, {
		setRelease: (release) => {
			mainLockRelease = release;
		},
		setRequest: (request) => {
			mainLockRequest = request;
		},
	});
}

async function acquireReadyLock(): Promise<boolean> {
	if (readyLockRelease) {
		return true;
	}
	return await acquireHeldLock(READY_LOCK_NAME, {
		setRelease: (release) => {
			readyLockRelease = release;
		},
		setRequest: (request) => {
			readyLockRequest = request;
		},
	});
}

async function acquireHeldLock(
	name: string,
	handlers: {
		setRelease: (release: (() => void) | null) => void;
		setRequest: (request: Promise<unknown> | null) => void;
	}
): Promise<boolean> {
	const locks = getLockManager();
	if (!locks) {
		return false;
	}

	let resolveRelease!: () => void;
	const releasePromise = new Promise<void>((resolve) => {
		resolveRelease = resolve;
	});

	let settled = false;
	const acquired = new Promise<boolean>((resolve) => {
		const resolveOnce = (value: boolean) => {
			if (!settled) {
				settled = true;
				resolve(value);
			}
		};

		const request = locks
			.request(
				name,
				{ mode: 'exclusive', ifAvailable: true },
				async (lock) => {
					if (!lock) {
						resolveOnce(false);
						return;
					}

					handlers.setRelease(resolveRelease);
					resolveOnce(true);
					await releasePromise;
				}
			)
			.catch(() => {
				handlers.setRelease(null);
				resolveOnce(false);
			});

		handlers.setRequest(request);
	});

	return acquired;
}

function releaseHeldLocks(): void {
	const releasePromises = [readyLockRequest, mainLockRequest].filter(
		(request): request is Promise<unknown> => !!request
	);

	if (readyLockRelease) {
		readyLockRelease();
	}
	if (mainLockRelease) {
		mainLockRelease();
	}

	readyLockRelease = null;
	mainLockRelease = null;
	readyLockRequest = null;
	mainLockRequest = null;

	pendingLockRelease = Promise.allSettled(releasePromises).then(
		() => undefined
	);
}

async function queryMainTabStatus(): Promise<MainTabStatus> {
	const locks = getLockManager();
	if (!locks?.query) {
		return 'missing';
	}

	try {
		const snapshot = await locks.query();
		const heldLockNames = new Set(
			(snapshot.held || [])
				.map((lock) => lock.name)
				.filter((name): name is string => typeof name === 'string')
		);

		if (heldLockNames.has(READY_LOCK_NAME)) {
			return 'connected';
		}
		if (heldLockNames.has(MAIN_LOCK_NAME)) {
			return 'booting';
		}
		return 'missing';
	} catch {
		return 'missing';
	}
}

function getLockManager(): LockManagerLike | null {
	if (typeof navigator === 'undefined') {
		return null;
	}
	return (navigator as Navigator & { locks?: LockManagerLike }).locks || null;
}

function setCurrentMainTabStatus(status: MainTabStatus): void {
	if (!currentTabInfo || currentTabInfo.mainTabStatus === status) {
		return;
	}
	currentTabInfo.mainTabStatus = status;
	currentOptions.onMainTabStatusChange?.(status);
}

function startMainTabStatusWatcher(): void {
	stopMainTabStatusWatcher();
	void refreshMainTabStatus();
	mainTabStatusPollInterval = setInterval(() => {
		void refreshMainTabStatus();
	}, MAIN_TAB_STATUS_POLL_INTERVAL_MS);

	if (
		typeof document !== 'undefined' &&
		'addEventListener' in document &&
		'visibilityState' in document
	) {
		visibilityChangeHandler = () => {
			if (document.visibilityState === 'visible') {
				void refreshMainTabStatus();
			}
		};
		document.addEventListener('visibilitychange', visibilityChangeHandler);
	}
}

function stopMainTabStatusWatcher(): void {
	if (mainTabStatusPollInterval) {
		clearInterval(mainTabStatusPollInterval);
		mainTabStatusPollInterval = null;
	}
	if (
		visibilityChangeHandler &&
		typeof document !== 'undefined' &&
		'removeEventListener' in document
	) {
		document.removeEventListener(
			'visibilitychange',
			visibilityChangeHandler
		);
	}
	visibilityChangeHandler = null;
}

function isCurrentMainTab(): boolean {
	return (
		!!currentTabInfo && !currentTabInfo.isDependentMode && !!mainLockRelease
	);
}

function getBrowserTabId(): string {
	const navigationType = getNavigationType();
	if (navigationType === 'reload') {
		const existingTabId = getStoredTabId();
		if (existingTabId) {
			return existingTabId;
		}
	}

	const tabId = createTabId();
	storeTabId(tabId);
	return tabId;
}

function getNavigationType(): string | undefined {
	if (typeof performance === 'undefined') {
		return;
	}
	const navigationEntries = performance.getEntriesByType?.('navigation');
	const navigation = navigationEntries?.[0];
	if (!navigation || !('type' in navigation)) {
		return;
	}
	return String(navigation.type);
}

function getStoredTabId(): string | null {
	try {
		return sessionStorage.getItem(TAB_ID_STORAGE_KEY);
	} catch {
		return null;
	}
}

function storeTabId(tabId: string): void {
	try {
		sessionStorage.setItem(TAB_ID_STORAGE_KEY, tabId);
	} catch {
		// sessionStorage can be unavailable in restricted browser contexts.
	}
}

function createTabId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createRequestId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function focusAndHighlightCurrentTab(): void {
	if (typeof window !== 'undefined') {
		window.focus();
	}
	if (typeof document === 'undefined') {
		return;
	}

	clearTitleFlash();

	titleFlashOriginalTitle = document.title;
	let isHighlighted = false;
	titleFlashInterval = setInterval(() => {
		if (titleFlashOriginalTitle === null) {
			return;
		}
		if (!isTitleFlashVariant(document.title, titleFlashOriginalTitle)) {
			titleFlashOriginalTitle = document.title;
			isHighlighted = false;
		}
		isHighlighted = !isHighlighted;
		document.title = isHighlighted
			? getHighlightedTitle(titleFlashOriginalTitle)
			: titleFlashOriginalTitle || '';
	}, 700);
	titleFlashTimeout = setTimeout(clearTitleFlash, 8000);
}

function clearTitleFlash(): void {
	const originalTitle = titleFlashOriginalTitle;
	if (titleFlashInterval) {
		clearInterval(titleFlashInterval);
		titleFlashInterval = null;
	}
	if (titleFlashTimeout) {
		clearTimeout(titleFlashTimeout);
		titleFlashTimeout = null;
	}
	if (
		originalTitle !== null &&
		typeof document !== 'undefined' &&
		isTitleFlashVariant(document.title, originalTitle)
	) {
		document.title = originalTitle;
	}
	titleFlashOriginalTitle = null;
}

function isTitleFlashVariant(title: string, originalTitle: string): boolean {
	return (
		title === originalTitle || title === getHighlightedTitle(originalTitle)
	);
}

function getHighlightedTitle(title: string): string {
	return `* ${title}`;
}
