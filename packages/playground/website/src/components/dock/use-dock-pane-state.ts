import { useState } from 'react';

export type DockPaneState = {
	isOpen: boolean;
	width: number;
	/** Makes the pane visible without changing its current width. */
	open: () => void;
	/** Hides the pane without discarding its current width. */
	close: () => void;
	/** Updates the width chosen by the caller's resizable layout. */
	setWidth: (width: number) => void;
};

/**
 * Keeps the two pane values that survive a close/reopen cycle together. Layout
 * constraints and persistence stay with the product that owns them.
 */
export function useDockPaneState(initialWidth: number): DockPaneState {
	const [isOpen, setIsOpen] = useState(false);
	const [width, setPaneWidth] = useState(initialWidth);

	return {
		isOpen,
		width,
		open: () => setIsOpen(true),
		close: () => setIsOpen(false),
		setWidth: (nextWidth) => setPaneWidth(nextWidth),
	};
}
