// @vitest-environment jsdom

import { transitionClonePane } from './transition-clone-pane';

afterEach(() => {
	vi.unstubAllGlobals();
	Reflect.deleteProperty(document, 'startViewTransition');
	document.documentElement.removeAttribute('data-clone-transition');
});

it('keeps Back active when the interrupted forward transition finishes', async () => {
	const pane = document.createElement('section');
	const finish: (() => void)[] = [];
	vi.stubGlobal('matchMedia', () => ({ matches: false }));
	Object.defineProperty(document, 'startViewTransition', {
		configurable: true,
		value: (update: () => void) => {
			update();
			return {
				finished: new Promise<void>((resolve) => finish.push(resolve)),
			};
		},
	});

	transitionClonePane(pane, 'forward', () => {});
	transitionClonePane(pane, 'back', () => {});
	finish[0]();
	await Promise.resolve();
	expect(document.documentElement.getAttribute('data-clone-transition')).toBe(
		'back'
	);
	expect(pane.getAttribute('data-clone-transition')).toBe('back');

	finish[1]();
	await Promise.resolve();
	expect(document.documentElement.hasAttribute('data-clone-transition')).toBe(
		false
	);
	expect(pane.hasAttribute('data-clone-transition')).toBe(false);
});
