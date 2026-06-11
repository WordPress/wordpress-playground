import { signal } from '@preact/signals-react';

export interface AISettingsState {
	openAiApiKey?: string;
	useAiForPrDescription: boolean;
}

export const AI_SETTINGS_KEY = 'playground-ai-settings';

// Persist the AI settings in localStorage in development mode so that
// they survive page reloads. In production, keep them in memory only –
// the same tradeoff made for the GitHub OAuth token in state.ts.
const shouldPersist = process.env.NODE_ENV === 'development';

function loadAISettings(): AISettingsState {
	if (shouldPersist) {
		try {
			const stored = localStorage.getItem(AI_SETTINGS_KEY);
			if (stored) {
				return JSON.parse(stored);
			}
		} catch {
			// Fall through to the defaults below.
		}
	}
	return { useAiForPrDescription: false };
}

export const aiSettingsState = signal<AISettingsState>(loadAISettings());

export function setAISettings(settings: Partial<AISettingsState>) {
	const updated = {
		...aiSettingsState.value,
		...settings,
	};
	aiSettingsState.value = updated;

	if (shouldPersist) {
		localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(updated));
	}
}

export function getAISettings(): AISettingsState {
	return aiSettingsState.value;
}
