import { stripWpPrefix } from './wp-cli-command';

export type TerminalMode = 'php' | 'wp-cli';

export type TerminalHistoryEntry = {
	command: string;
	output: string;
	error?: string;
	status: 'success' | 'error';
	durationMs: number;
};

export type TerminalHistory = Record<TerminalMode, TerminalHistoryEntry[]>;

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
			php: getEntries(stored?.php, 'php'),
			'wp-cli': getEntries(stored?.['wp-cli'], 'wp-cli'),
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

export function appendEntryToHistory(
	history: TerminalHistory,
	mode: TerminalMode,
	entry: TerminalHistoryEntry
): TerminalHistory {
	return {
		...history,
		[mode]: [...history[mode], entry].slice(-MAX_HISTORY_ENTRIES),
	};
}

function getEntries(value: unknown, mode: TerminalMode) {
	return Array.isArray(value)
		? value
				.map((entry) => normalizeEntry(entry, mode))
				.filter(
					(entry): entry is TerminalHistoryEntry =>
						entry !== undefined
				)
				.slice(-MAX_HISTORY_ENTRIES)
		: [];
}

function normalizeEntry(entry: unknown, mode: TerminalMode) {
	if (typeof entry === 'string') {
		return {
			command: normalizeCommand(entry, mode),
			output: '',
			status: 'success' as const,
			durationMs: 0,
		};
	}

	if (!entry || typeof entry !== 'object') {
		return undefined;
	}

	const maybeEntry = entry as Partial<TerminalHistoryEntry>;
	if (
		typeof maybeEntry.command !== 'string' ||
		typeof maybeEntry.output !== 'string' ||
		(maybeEntry.status !== 'success' && maybeEntry.status !== 'error') ||
		typeof maybeEntry.durationMs !== 'number'
	) {
		return undefined;
	}

	const normalizedEntry: TerminalHistoryEntry = {
		command: normalizeCommand(maybeEntry.command, mode),
		output: maybeEntry.output,
		status: maybeEntry.status,
		durationMs: maybeEntry.durationMs,
	};
	if (typeof maybeEntry.error === 'string') {
		normalizedEntry.error = maybeEntry.error;
	}
	return normalizedEntry;
}

function normalizeCommand(command: string, mode: TerminalMode) {
	return mode === 'wp-cli' ? `wp ${stripWpPrefix(command)}` : command;
}
