import { flushSync } from 'react-dom';

/** Keep New and Clone on the same surface in either direction. */
export function transitionClonePane(
	pane: HTMLElement,
	direction: 'forward' | 'back',
	update: () => void
) {
	const render = () => {
		// Commit the destination before the browser measures its new layout.
		flushSync(update);
		if (direction === 'back') {
			pane.querySelector<HTMLButtonElement>(
				'#clone-site-launcher'
			)?.focus();
		}
	};
	const transitionDocument = document as Document & {
		startViewTransition?: (update: () => void) => {
			finished: Promise<void>;
		};
	};
	if (
		!transitionDocument.startViewTransition ||
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	) {
		render();
		return;
	}
	const root = document.documentElement;
	pane.setAttribute('data-clone-transition', direction);
	root.setAttribute('data-clone-transition', direction);
	const transition = transitionDocument.startViewTransition(render);
	const cleanup = () => {
		// Back can skip an unfinished forward transition. Its cleanup must not
		// remove the names that Back is still using.
		if (root.getAttribute('data-clone-transition') !== direction) return;
		pane.removeAttribute('data-clone-transition');
		root.removeAttribute('data-clone-transition');
	};
	// Skipping a transition must also release its temporary names.
	void transition.finished.then(cleanup, cleanup);
}
