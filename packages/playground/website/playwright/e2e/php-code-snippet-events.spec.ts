import { test, expect } from '@playwright/test';

test.describe('php-snippet event isolation', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('./php-code-snippet-e2e.html');
		await page.evaluate(() => customElements.whenDefined('php-snippet'));
		await expect(
			page.locator('php-snippet[name="scratch.php"] textarea.ta')
		).toBeVisible();
	});

	test('keeps typing and Run inside a surrounding rich-text editor', async ({
		page,
	}) => {
		const snippet = page.locator('php-snippet[name="scratch.php"]');
		await snippet.evaluate(async (element: any) => {
			const editor = document.createElement('div');
			editor.id = 'outer-editor';
			editor.contentEditable = 'true';
			element.before(editor);
			editor.append(element);
			await element._ready;
			element._runOnce = async function (code: string) {
				this.shadowRoot.querySelector('.output-body').textContent =
					code;
				this.shadowRoot
					.querySelector('.output')
					.classList.add('visible');
			};
			editor.dataset.events = '';
			for (const type of [
				'keydown',
				'keypress',
				'keyup',
				'beforeinput',
				'input',
				'focusin',
				'focusout',
				'click',
				'pointerdown',
				'pointerup',
				'mousedown',
				'mouseup',
			]) {
				editor.addEventListener(type, () => {
					editor.dataset.events += `${type} `;
				});
			}
		});

		const textarea = snippet.locator('textarea.ta');
		await textarea.fill('');
		await textarea.pressSequentially('<?php echo "hello";');
		await textarea.press('Tab');
		await textarea.press('Enter');
		await textarea.pressSequentially('// edited');
		const code = '<?php echo "hello";\t\n// edited';
		await expect(textarea).toHaveValue(code);
		await expect(snippet.locator('.hl')).toHaveText(code);
		await textarea.press('Control+Enter');
		await expect(snippet.locator('.output-body')).toHaveText(code);
		await snippet.locator('.run').click();
		await expect(textarea).toBeFocused();
		await expect(page.locator('#outer-editor')).toHaveAttribute(
			'data-events',
			''
		);

		// The surrounding editor must still receive its own events.
		await page.locator('#outer-editor').evaluate((editor) => {
			const paragraph = document.createElement('p');
			paragraph.textContent = 'Article';
			editor.append(paragraph);
		});
		await page.locator('#outer-editor p').click();
		await page.keyboard.type('!');
		await expect(page.locator('#outer-editor')).toHaveAttribute(
			'data-events',
			/keydown.*input.*keyup/
		);
	});

	for (const [category, types] of Object.entries({
		keyboard: ['keydown', 'keypress', 'keyup'],
		editing: [
			'beforeinput',
			'input',
			'change',
			'compositionstart',
			'compositionupdate',
			'compositionend',
		],
		clipboard: ['copy', 'cut', 'paste'],
		focus: ['focusin', 'focusout'],
		mouse: [
			'click',
			'dblclick',
			'auxclick',
			'contextmenu',
			'mousedown',
			'mouseup',
			'mousemove',
			'mouseover',
			'mouseout',
			'wheel',
		],
		pointer: [
			'pointerdown',
			'pointerup',
			'pointermove',
			'pointerover',
			'pointerout',
			'pointercancel',
			'pointerrawupdate',
			'gotpointercapture',
			'lostpointercapture',
		],
		touch: ['touchstart', 'touchmove', 'touchend', 'touchcancel'],
		drag: [
			'dragstart',
			'drag',
			'dragend',
			'dragenter',
			'dragleave',
			'dragover',
			'drop',
		],
	})) {
		test(`contains composed ${category} events across the snippet`, async ({
			page,
		}) => {
			const result = await page
				.locator('php-snippet[name="scratch.php"]')
				.evaluate((snippet: any, eventTypes) => {
					// Keep synthetic clicks local; PHP execution has separate tests.
					snippet._run = () => {};
					const escaped: string[] = [];
					const cancelled: string[] = [];
					const received: string[] = [];
					for (const target of [
						snippet,
						snippet.parentElement,
						document,
						window,
					]) {
						for (const type of eventTypes) {
							target.addEventListener(type, () =>
								escaped.push(type)
							);
						}
					}
					for (const selector of [
						'textarea.ta',
						'.run',
						'.hl',
						'.output-body',
					]) {
						const target =
							snippet.shadowRoot.querySelector(selector);
						for (const type of eventTypes) {
							target.addEventListener(
								type,
								() => received.push(`${selector}:${type}`),
								{ once: true }
							);
							const event = new Event(type, {
								bubbles: true,
								composed: true,
								cancelable: true,
							});
							target.dispatchEvent(event);
							if (event.defaultPrevented)
								cancelled.push(`${selector}:${type}`);
						}
					}
					return { escaped, cancelled, received };
				}, types);
			expect(result.escaped).toEqual([]);
			expect(result.cancelled).toEqual([]);
			expect(result.received).toEqual(
				['textarea.ta', '.run', '.hl', '.output-body'].flatMap(
					(selector) => types.map((type) => `${selector}:${type}`)
				)
			);
		});
	}
});
