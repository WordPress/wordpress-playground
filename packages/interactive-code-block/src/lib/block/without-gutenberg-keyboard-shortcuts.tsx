import * as React from 'react';
import { useEffect } from '@wordpress/element';
import { KeyboardShortcuts } from '@wordpress/components';
import { rawShortcut } from '@wordpress/keycodes';

const stop = (e) => e.stopImmediatePropagation();

const characters = [
	'a',
	'b',
	'c',
	'd',
	'e',
	'f',
	'g',
	'h',
	'i',
	'j',
	'k',
	'l',
	'm',
	'n',
	'o',
	'p',
	'q',
	'r',
	's',
	't',
	'u',
	'v',
	'w',
	'x',
	'y',
	'z',
	'tab',
	'[',
	']',
	'{',
	'}',
];

const shortcutOverrides = Object.fromEntries(
	characters.flatMap((character) => [
		[character, stop],
		[rawShortcut.access(character), stop],
		[rawShortcut.ctrl(character), stop],
		[rawShortcut.ctrlShift(character), stop],
		[rawShortcut.primary(character), stop],
		[rawShortcut.primaryShift(character), stop],
		[rawShortcut.primaryAlt(character), stop],
	])
);

interface WithoutGutenbergKeyboardShortcutsProps {
	isSelected: boolean;
	children?: any;
}

export function WithoutGutenbergKeyboardShortcuts({
	children,
	isSelected,
}: WithoutGutenbergKeyboardShortcutsProps) {
	useEffect(() => {
		// Disable the global copy handlers when the block is selected.
		if (isSelected) {
			// Capture: true ensures this gets triggered before Gutenberg's
			// copy handler.
			document.addEventListener('copy', stop, { capture: true });
			document.addEventListener('cut', stop, { capture: true });
			document.addEventListener('paste', stop, { capture: true });
			return () => {
				document.removeEventListener('copy', stop, { capture: true });
				document.removeEventListener('cut', stop, { capture: true });
				document.removeEventListener('paste', stop, { capture: true });
			};
		}
	}, [isSelected]);
	// Prevent regular keyboard shortcuts from bubbling to the editor:
	return (
		<KeyboardShortcuts shortcuts={shortcutOverrides}>
			{children}
		</KeyboardShortcuts>
	);
}
