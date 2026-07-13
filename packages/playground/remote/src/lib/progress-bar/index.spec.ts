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

		expect(progressBar.labelElement.textContent).toBe(
			'Starting Your Playground:'
		);
		expect(progressBar.titleElement.textContent).toBe('Curious Harbor');
		expect(progressBar.captionElement.textContent).toBe(
			'Preparing WordPress'
		);
		expect(
			progressBar.element.querySelectorAll('h1, h2, h3, h4, h5, h6')
		).toHaveLength(0);
		expect(progressBar.captionElement.getAttribute('role')).toBe('status');
		expect(progressBar.captionElement.getAttribute('aria-live')).toBe(
			'polite'
		);
		expect(progressBar.captionElement.getAttribute('aria-atomic')).toBe(
			'true'
		);

		progressBar.setOptions({ caption: 'Installing WordPress' });

		expect(progressBar.titleElement.textContent).toBe('Curious Harbor');
		expect(progressBar.captionElement.textContent).toBe(
			'Installing WordPress'
		);
	});

	it('can clear the Playground name and caption', () => {
		const progressBar = new ProgressBar({
			title: 'Curious Harbor',
			caption: 'Preparing WordPress',
		});

		progressBar.setOptions({ title: undefined, caption: '' });

		expect(progressBar.title).toBe('');
		expect(progressBar.titleElement.textContent).toBe('');
		expect(progressBar.titleElement.hidden).toBe(true);
		expect(progressBar.labelElement.hidden).toBe(true);
		expect(progressBar.caption).toBe('');
		expect(progressBar.captionElement.textContent).toBe('');
	});
});
