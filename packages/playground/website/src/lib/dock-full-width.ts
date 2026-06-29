/**
 * Persists whether the user pinned the dock to full width (docked mode) across
 * sessions, so reopening Playground keeps the dock the way they left it. Read
 * once when the UI store initializes; written when the user toggles the mode.
 */
const STORAGE_KEY = 'playground-dock-full-width';

export function readDockFullWidth(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

export function writeDockFullWidth(full: boolean): void {
	try {
		if (full) {
			localStorage.setItem(STORAGE_KEY, 'true');
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	} catch {
		// Best-effort: the dock still works if the preference can't be saved.
	}
}
