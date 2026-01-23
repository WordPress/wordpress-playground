import { useState, useEffect, useRef, useCallback } from 'react';
import { useActiveSite } from '../state/redux/store';
import {
	getCurrentTabInfo,
	checkForExistingTabs,
	type TabInfo,
} from '../state/redux/tab-coordinator';

interface UseTabTrackingOptions {
	onWorkerLost?: () => void;
}

interface UseTabTrackingResult {
	tabInfo: TabInfo | null;
	otherTabs: TabInfo[];
	workerLost: boolean;
}

export function useTabTracking(
	hasOwnWorker: boolean,
	options: UseTabTrackingOptions = {}
): UseTabTrackingResult {
	const activeSite = useActiveSite();
	const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
	const [otherTabs, setOtherTabs] = useState<TabInfo[]>([]);
	const [workerLost, setWorkerLost] = useState(false);
	const knownTabsRef = useRef<Map<string, TabInfo>>(new Map());
	const recentlyBecameDependentRef = useRef(false);
	const hasOwnWorkerRef = useRef(hasOwnWorker);

	hasOwnWorkerRef.current = hasOwnWorker;

	useEffect(() => {
		const currentTab = getCurrentTabInfo();
		if (currentTab) {
			setTabInfo(currentTab);
		}
	}, [activeSite]);

	useEffect(() => {
		if (!hasOwnWorker) {
			recentlyBecameDependentRef.current = true;
			setWorkerLost(false);
			const timer = setTimeout(() => {
				recentlyBecameDependentRef.current = false;
			}, 5000);
			return () => clearTimeout(timer);
		}
	}, [hasOwnWorker]);

	const checkWorkerLost = useCallback(() => {
		if (
			!hasOwnWorkerRef.current &&
			knownTabsRef.current.size === 0 &&
			!recentlyBecameDependentRef.current
		) {
			setWorkerLost(true);
			options.onWorkerLost?.();
		}
	}, [options]);

	useEffect(() => {
		if (!activeSite || !tabInfo) {
			return;
		}

		const siteSlug = activeSite.slug;
		let isActive = true;
		const knownTabs = knownTabsRef.current;

		async function checkTabs() {
			try {
				const { existingTabs } = await checkForExistingTabs(siteSlug);
				if (!isActive) return;

				knownTabs.clear();
				existingTabs.forEach((tab) => knownTabs.set(tab.tabId, tab));
				setOtherTabs(Array.from(knownTabs.values()));
				checkWorkerLost();
			} catch {
				// Failed to check for existing tabs - continue without error
			}
		}

		checkTabs();

		let channel: BroadcastChannel | null = null;
		try {
			channel = new BroadcastChannel('playground-tab-coordinator');

			const handleMessage = (event: MessageEvent) => {
				const message = event.data;

				if (
					message.type === 'ping' &&
					message.siteSlug === siteSlug &&
					message.tabId !== tabInfo.tabId
				) {
					const pingTabInfo: TabInfo = {
						tabId: message.tabId,
						siteSlug: message.siteSlug,
						createdAt: Date.now(),
					};
					knownTabs.set(message.tabId, pingTabInfo);
					setOtherTabs(Array.from(knownTabs.values()));
				} else if (message.type === 'pong' && message.tabInfo) {
					const otherTabId = message.tabInfo.tabId;
					if (otherTabId !== tabInfo.tabId) {
						knownTabs.set(otherTabId, message.tabInfo);
						setOtherTabs(Array.from(knownTabs.values()));
					}
				} else if (
					message.type === 'tab-closing' &&
					message.tabId !== tabInfo.tabId
				) {
					knownTabs.delete(message.tabId);
					setOtherTabs(Array.from(knownTabs.values()));
					checkWorkerLost();
				}
			};

			channel.addEventListener('message', handleMessage);

			const refreshInterval = setInterval(checkTabs, 60000);

			return () => {
				isActive = false;
				if (channel) {
					channel.removeEventListener('message', handleMessage);
					channel.close();
				}
				clearInterval(refreshInterval);
			};
		} catch {
			// BroadcastChannel not supported - use polling fallback
			const fallbackInterval = setInterval(checkTabs, 60000);
			return () => {
				isActive = false;
				clearInterval(fallbackInterval);
			};
		}
	}, [activeSite, tabInfo, checkWorkerLost]);

	return {
		tabInfo,
		otherTabs,
		workerLost,
	};
}
