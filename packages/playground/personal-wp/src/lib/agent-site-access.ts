/**
 * This tab's agent site access, shared by the WebMCP setup and the UI: the
 * grant controller and the confirmation the user is being asked for.
 */
import { useSyncExternalStore } from 'react';
import type { SiteAccess, SiteAccessSnapshot } from '@wp-playground/mcp/client';
import { createSiteAccessPrompt } from '@wp-playground/mcp/client';

export const agentSiteAccessPrompt = createSiteAccessPrompt();

let siteAccess: SiteAccess | undefined;
const listeners = new Set<() => void>();

export function setAgentSiteAccess(access: SiteAccess) {
	siteAccess = access;
	access.subscribe(notify);
	notify();
}

/** The controller and its current state, or undefined before WebMCP starts. */
export function useAgentSiteAccess(): {
	access: SiteAccess | undefined;
	snapshot: SiteAccessSnapshot | undefined;
} {
	const snapshot = useSyncExternalStore(subscribe, () =>
		siteAccess?.getSnapshot()
	);
	return { access: siteAccess, snapshot };
}

export function usePendingSiteAccessRequest() {
	return useSyncExternalStore(
		agentSiteAccessPrompt.subscribe,
		agentSiteAccessPrompt.getPending
	);
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function notify() {
	for (const listener of listeners) {
		listener();
	}
}
