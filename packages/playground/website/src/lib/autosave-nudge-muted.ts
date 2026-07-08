/**
 * Persists the user's choice to mute the proactive autosave-restore cues (the
 * dock's autosave nudge panel and the dot on the Playgrounds tool) across
 * sessions. Muting only silences the cues — autosaves stay restorable from Your
 * Playgrounds — so this is a UI preference, not a safety setting. Read once when
 * the UI store initializes; written when the user toggles notices from the panel.
 */
const STORAGE_KEY = 'playground-autosave-nudge-muted';

export function readAutosaveNudgeMuted(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		// Storage may be unavailable (private mode, blocked cookies). Default to
		// showing the notices rather than silently muting them.
		return false;
	}
}

export function writeAutosaveNudgeMuted(muted: boolean): void {
	try {
		if (muted) {
			localStorage.setItem(STORAGE_KEY, 'true');
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	} catch {
		// Best-effort: muting is a preference, so ignore storage failures.
	}
}
