const STORAGE_KEY = 'playground-disable-autosave-restore-notifications';

/** Reads the user's durable choice to stop offering matching autosaves. */
export function areAutosaveRestoreNotificationsDisabled(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

/** Persists the user's choice after the current Playground was safely kept. */
export function disableAutosaveRestoreNotifications(): void {
	try {
		localStorage.setItem(STORAGE_KEY, 'true');
	} catch {
		// The current dismissal still succeeds when private storage is unavailable.
	}
}
