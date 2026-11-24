/**
 * Persists whether the user pinned the Dock to full width across sessions, so
 * reopening Playground keeps the Dock the way they left it.
 */
const STORAGE_KEY = 'playground-dock-full-width';

export function readDockFullWidth(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

export function writeDockFullWidth(fullWidth: boolean): void {
	try {
		if (fullWidth) {
			localStorage.setItem(STORAGE_KEY, 'true');
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	} catch {
		// Best-effort: the Dock still works if the preference cannot be saved.
	}
}
