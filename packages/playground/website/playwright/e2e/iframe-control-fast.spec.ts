import { test, expect, chromium, Browser, Page } from '@playwright/test';

/**
 * Fast tests for iframe SW control.
 * Navigates directly to the empty.html loader (which has iframes-trap.js)
 * and tests various iframe creation methods.
 * Each test should complete in under 10 seconds.
 */

let browser: Browser;
let page: Page;
let baseUrl: string;

test.beforeAll(async () => {
	browser = await chromium.launch({
		args: ['--js-flags=--enable-experimental-webassembly-jspi'],
	});
});

test.afterAll(async () => {
	await browser?.close();
});

test.beforeEach(async () => {
	const context = await browser.newContext({
		serviceWorkers: 'allow',
	});
	page = await context.newPage();

	// First, navigate to the main page to register the SW
	baseUrl =
		process.env.PLAYWRIGHT_TEST_BASE_URL ||
		'http://127.0.0.1:5400/website-server/';
	await page.goto(baseUrl);

	// Wait for SW to register
	await page.evaluate(async () => {
		await navigator.serviceWorker?.ready;
	});

	// Navigate to the loader page (served by SW, has iframes-trap.js)
	await page.goto(
		baseUrl.replace('/website-server/', '/scope:test-fast/wp-includes/empty.html')
	);
	await page.waitForTimeout(300);
});

test.afterEach(async () => {
	await page?.context().close();
});

async function testIframe(
	createFn: () => Promise<{ iframe: HTMLIFrameElement; description: string }>
) {
	return page.evaluate(async (createFnStr) => {
		// Wait for the iframe to be processed and loaded
		const waitForController = async (
			iframe: HTMLIFrameElement,
			timeout = 3000
		) => {
			const start = Date.now();
			while (Date.now() - start < timeout) {
				try {
					if (iframe.contentWindow?.navigator?.serviceWorker?.controller) {
						return true;
					}
				} catch {
					// Cross-origin, keep waiting
				}
				await new Promise((r) => setTimeout(r, 100));
			}
			return false;
		};

		// Wait for iframe content to be loaded (loader script execution completes)
		const waitForContentLoad = async (
			iframe: HTMLIFrameElement,
			timeout = 3000
		) => {
			const start = Date.now();
			while (Date.now() - start < timeout) {
				try {
					// Check if body has real content (h1, div, etc.)
					const bodyHTML = iframe.contentDocument?.body?.innerHTML || '';
					// The loader inserts content after its inline script runs
					// Look for actual HTML tags that indicate content was injected
					if (bodyHTML.includes('<h1>') || bodyHTML.includes('<div>') || bodyHTML.includes('<p>')) {
						return;
					}
				} catch {
					// Cross-origin, keep waiting
				}
				await new Promise((r) => setTimeout(r, 100));
			}
		};

		const parentHasController = !!navigator.serviceWorker?.controller;

		// Create the iframe using the provided function
		const createFnEval = new Function('document', `return (${createFnStr})()`);
		const { iframe, description } = await createFnEval(document);

		// Wait for data-controlled attribute
		await new Promise((r) => setTimeout(r, 500));
		const dataControlled = iframe.getAttribute('data-controlled');
		const iframeSrc = iframe.src;

		// Wait for controller
		const hasController = await waitForController(iframe);

		// Wait for content to be loaded if iframe has an id in the hash (srcdoc/data/blob case)
		if (iframeSrc.includes('id=')) {
			await waitForContentLoad(iframe);
		}

		let iframeContent = '';
		try {
			iframeContent =
				iframe.contentDocument?.documentElement?.outerHTML?.substring(
					0,
					500
				) || '';
		} catch {
			iframeContent = '[cross-origin]';
		}

		return {
			description,
			parentHasController,
			dataControlled,
			iframeSrc,
			hasController,
			iframeContent,
		};
	}, createFn.toString());
}

test('blank iframe via createElement', async () => {
	test.setTimeout(10000);

	const result = await testIframe(async () => {
		const iframe = document.createElement('iframe');
		document.body.appendChild(iframe);
		return { iframe, description: 'createElement + appendChild' };
	});

	console.log('Result:', JSON.stringify(result, null, 2));
	expect(result.parentHasController).toBe(true);
	expect(result.dataControlled).toBe('1');
	expect(result.iframeSrc).toContain('empty.html');
	expect(result.hasController).toBe(true);
});

test('iframe with srcdoc attribute', async () => {
	test.setTimeout(10000);

	const result = await testIframe(async () => {
		const iframe = document.createElement('iframe');
		iframe.srcdoc = '<html><body><h1>Hello from srcdoc</h1></body></html>';
		document.body.appendChild(iframe);
		return { iframe, description: 'srcdoc attribute' };
	});

	console.log('Result:', JSON.stringify(result, null, 2));
	expect(result.parentHasController).toBe(true);
	expect(result.dataControlled).toBe('1');
	expect(result.iframeSrc).toContain('empty.html');
	expect(result.hasController).toBe(true);
	// The content should contain our injected content
	expect(result.iframeContent).toContain('Hello from srcdoc');
});

test('iframe with src=about:blank', async () => {
	test.setTimeout(10000);

	const result = await testIframe(async () => {
		const iframe = document.createElement('iframe');
		iframe.src = 'about:blank';
		document.body.appendChild(iframe);
		return { iframe, description: 'src=about:blank' };
	});

	console.log('Result:', JSON.stringify(result, null, 2));
	expect(result.parentHasController).toBe(true);
	expect(result.dataControlled).toBe('1');
	expect(result.iframeSrc).toContain('empty.html');
	expect(result.hasController).toBe(true);
});

test('iframe added via innerHTML', async () => {
	test.setTimeout(10000);

	const result = await testIframe(async () => {
		const div = document.createElement('div');
		div.innerHTML = '<iframe></iframe>';
		document.body.appendChild(div);
		const iframe = div.querySelector('iframe') as HTMLIFrameElement;
		return { iframe, description: 'innerHTML' };
	});

	console.log('Result:', JSON.stringify(result, null, 2));
	expect(result.parentHasController).toBe(true);
	expect(result.dataControlled).toBe('1');
	expect(result.iframeSrc).toContain('empty.html');
	expect(result.hasController).toBe(true);
});

test('iframe with data: URL', async () => {
	test.setTimeout(10000);

	const result = await testIframe(async () => {
		const iframe = document.createElement('iframe');
		iframe.src =
			'data:text/html,<html><body><h1>Hello from data URL</h1></body></html>';
		document.body.appendChild(iframe);
		return { iframe, description: 'data: URL' };
	});

	console.log('Result:', JSON.stringify(result, null, 2));
	expect(result.parentHasController).toBe(true);
	expect(result.dataControlled).toBe('1');
	expect(result.iframeSrc).toContain('empty.html');
	expect(result.hasController).toBe(true);
	expect(result.iframeContent).toContain('Hello from data URL');
});
