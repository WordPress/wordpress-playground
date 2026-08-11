// @vitest-environment jsdom

import {
	addCommandToHistory,
	loadTerminalHistory,
	saveTerminalHistory,
} from './terminal-history';
import type { TerminalHistory } from './terminal-history';

describe('terminal history', () => {
	beforeEach(() => localStorage.clear());

	it('persists independent PHP and WP-CLI histories', () => {
		let history = loadTerminalHistory();
		history = addCommandToHistory(history, 'php', '$a = 123;');
		history = addCommandToHistory(history, 'wp-cli', 'option get blogname');
		saveTerminalHistory(history);

		expect(loadTerminalHistory()).toEqual({
			php: ['$a = 123;'],
			'wp-cli': ['option get blogname'],
		});
	});

	it('removes the executable from older WP-CLI history entries', () => {
		localStorage.setItem(
			'playground-terminal-command-history',
			JSON.stringify({ php: [], 'wp-cli': ['wp option list'] })
		);

		expect(loadTerminalHistory()['wp-cli']).toEqual(['option list']);
	});

	it('moves a repeated command to the front instead of duplicating it', () => {
		let history: TerminalHistory = {
			php: ['echo 2;', 'echo 1;'],
			'wp-cli': [],
		};

		history = addCommandToHistory(history, 'php', 'echo 1;');

		expect(history.php).toEqual(['echo 1;', 'echo 2;']);
	});
});
