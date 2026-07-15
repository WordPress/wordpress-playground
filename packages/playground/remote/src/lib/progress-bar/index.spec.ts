// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import ProgressBar from '.';

describe('ProgressBar', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('shows the boot caption as a heading and announces updates', () => {
		const progressBar = new ProgressBar({
			caption: 'Preparing WordPress',
		});

		expect(progressBar.captionElement.textContent).toBe(
			'Preparing WordPress'
		);
		expect(
			progressBar.element.querySelectorAll('h1, h2, h3, h4, h5, h6')
		).toHaveLength(1);
		expect(progressBar.statusElement.getAttribute('role')).toBe('status');
		expect(progressBar.statusElement.getAttribute('aria-live')).toBe(
			'polite'
		);
		expect(progressBar.statusElement.getAttribute('aria-atomic')).toBe(
			'true'
		);

		progressBar.setOptions({ caption: 'Installing WordPress' });

		expect(progressBar.captionElement.textContent).toBe(
			'Installing WordPress'
		);
		expect(progressBar.statusElement.textContent).toBe(
			'Installing WordPress'
		);
	});

	it('can clear the boot caption', () => {
		const progressBar = new ProgressBar({
			caption: 'Preparing WordPress',
		});

		progressBar.setOptions({ caption: '' });

		expect(progressBar.caption).toBe('');
		expect(progressBar.captionElement.textContent).toBe('');
	});
});
