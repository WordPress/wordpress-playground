import { stripWpPrefix } from './wp-cli-command';

export type TerminalMode = 'php' | 'wp-cli';
export type TerminalHistory = Record<TerminalMode, string[]>;

const STORAGE_KEY = 'playground-terminal-command-history';
const MAX_HISTORY_ENTRIES = 100;

const EMPTY_HISTORY: TerminalHistory = {
	php: [],
	'wp-cli': [],
};

export function loadTerminalHistory(): TerminalHistory {
	if (typeof localStorage === 'undefined') {
		return EMPTY_HISTORY;
	}

	try {
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
		return {
			php: getStringArray(stored?.php),
			'wp-cli': getStringArray(stored?.['wp-cli']).map(stripWpPrefix),
		};
	} catch {
		return EMPTY_HISTORY;
	}
}

export function saveTerminalHistory(history: TerminalHistory) {
	if (typeof localStorage === 'undefined') {
		return;
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
	} catch {
		// Browsing contexts may disable storage. History still works in memory.
	}
}

export function addCommandToHistory(
	history: TerminalHistory,
	mode: TerminalMode,
	command: string
): TerminalHistory {
	return {
		...history,
		[mode]: [
			command,
			...history[mode].filter((entry) => entry !== command),
		].slice(0, MAX_HISTORY_ENTRIES),
	};
}

function getStringArray(value: unknown) {
	return Array.isArray(value)
		? value
				.filter((entry): entry is string => typeof entry === 'string')
				.slice(0, MAX_HISTORY_ENTRIES)
		: [];
}
