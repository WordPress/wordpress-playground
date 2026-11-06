// @vitest-environment jsdom

import {
	appendEntryToHistory,
	loadTerminalHistory,
	saveTerminalHistory,
} from './terminal-history';

describe('terminal history', () => {
	beforeEach(() => localStorage.clear());

	it('persists independent PHP and WP-CLI entries', () => {
		let history = loadTerminalHistory();
		history = appendEntryToHistory(history, 'php', {
			command: '$a = 123;',
			output: '123',
			status: 'success',
			durationMs: 12,
		});
		history = appendEntryToHistory(history, 'wp-cli', {
			command: 'wp option get blogname',
			output: 'Playground',
			status: 'success',
			durationMs: 34,
		});
		saveTerminalHistory(history);

		expect(loadTerminalHistory()).toEqual({
			php: [
				{
					command: '$a = 123;',
					output: '123',
					status: 'success',
					durationMs: 12,
				},
			],
			'wp-cli': [
				{
					command: 'wp option get blogname',
					output: 'Playground',
					status: 'success',
					durationMs: 34,
				},
			],
		});
	});

	it('migrates older string-only WP-CLI history entries', () => {
		localStorage.setItem(
			'playground-terminal-command-history',
			JSON.stringify({ php: [], 'wp-cli': ['option list'] })
		);

		expect(loadTerminalHistory()['wp-cli']).toEqual([
			{
				command: 'wp option list',
				output: '',
				status: 'success',
				durationMs: 0,
			},
		]);
	});

	it('appends repeated commands instead of deduplicating them', () => {
		let history = loadTerminalHistory();

		history = appendEntryToHistory(history, 'php', {
			command: 'echo 1;',
			output: '1',
			status: 'success',
			durationMs: 1,
		});
		history = appendEntryToHistory(history, 'php', {
			command: 'echo 1;',
			output: '1',
			status: 'success',
			durationMs: 2,
		});

		expect(history.php).toHaveLength(2);
	});
});
