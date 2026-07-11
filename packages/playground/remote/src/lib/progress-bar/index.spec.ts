// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import ProgressBar from '.';

describe('ProgressBar', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('keeps the Playground name stable while its boot caption changes', () => {
		const progressBar = new ProgressBar({
			title: 'Curious Harbor',
			caption: 'Preparing WordPress',
		});

		expect(progressBar.element.querySelector('p')?.textContent).toBe(
			'Starting Your Playground:'
		);
		expect(progressBar.element.querySelector('h2')?.textContent).toBe(
			'Curious Harbor'
		);
		expect(progressBar.element.querySelector('h3')?.textContent).toBe(
			'Preparing WordPress'
		);

		progressBar.setOptions({ caption: 'Installing WordPress' });

		expect(progressBar.element.querySelector('h2')?.textContent).toBe(
			'Curious Harbor'
		);
		expect(progressBar.element.querySelector('h3')?.textContent).toBe(
			'Installing WordPress'
		);
	});
});
